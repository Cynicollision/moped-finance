import { PGlite } from '@electric-sql/pglite';
import { is, SQL } from 'drizzle-orm';
import { getTableConfig, PgDialect, PgTable } from 'drizzle-orm/pg-core';
import { accountSchema } from '@server/api/accounts/account-schema';
import { balanceHistorySchema } from '@server/api/accounts/balance-history-schema';
import { budgetStreamSchema } from '@server/api/budget/budget-stream-schema';
import { categoryGroupSchema } from '@server/api/categories/category-groups/category-group-schema';
import { categorySchema } from '@server/api/categories/category-schema';
import { institutionSchema } from '@server/api/institutions/institution-schema';
import { transactionSchema } from '@server/api/transactions/transaction-schema';
import { userSchema } from '@server/auth/user-data';
import { logSchema } from '@server/logging/log-data';
import { TestDatabaseUtil } from '@server/utility/testing';

// The schema is defined twice: the SQL scripts (used by db:init and these tests) and the Drizzle tables
// (used by the app, and the future source for drizzle-kit migrations). This spec fails when they drift.

const tables: PgTable[] = [
    userSchema,
    logSchema,
    institutionSchema,
    accountSchema,
    balanceHistorySchema,
    categoryGroupSchema,
    categorySchema,
    transactionSchema,
    budgetStreamSchema,
];

const dialect = new PgDialect();

const onDeleteCodes: Record<string, string> = {
    a: 'no action',
    r: 'restrict',
    c: 'cascade',
    n: 'set null',
    d: 'set default',
};

function normalizeType(type: string): string {
    return type.replace('character varying', 'varchar').replace(/\s/g, '');
}

// Reduces an index expression to a comparable form: `lower((name)::text)` and `lower("t"."name")` both become `lowername`.
function normalizeExpression(expression: string): string {
    return expression
        .replace(/::\w+(\[\])?/g, '')
        .replace(/"/g, '')
        .replace(/\w+\./g, '')
        .replace(/[()\s]/g, '')
        .toLowerCase();
}

function quotedValues(text: string): string[] {
    return [...text.matchAll(/'([^']*)'/g)].map(match => match[1]).sort();
}

describe('Schema parity (SQL scripts vs Drizzle)', () => {
    let pglite: PGlite;

    beforeAll(async () => {
        pglite = (await TestDatabaseUtil.createMockDatabase()).pglite;
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    async function query<T>(sqlText: string, schema: string, table: string): Promise<T[]> {
        const result = await pglite.query<T>(sqlText, [schema, table]);
        return result.rows;
    }

    describe.each(tables.map(table => [`${getTableConfig(table).schema}.${getTableConfig(table).name}`, table] as const))('%s', (_, table) => {
        const config = getTableConfig(table);
        const schema = config.schema ?? 'public';

        it('has the same columns', async () => {
            const rows = await query<{ name: string, type: string, not_null: boolean, has_default: boolean }>(`
                SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS not_null, a.atthasdef AS has_default
                FROM pg_attribute a
                JOIN pg_class c ON c.oid = a.attrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = $1 AND c.relname = $2 AND a.attnum > 0 AND NOT a.attisdropped
            `, schema, config.name);

            const fromSql = rows
                .map(row => ({ name: row.name, type: normalizeType(row.type), notNull: row.not_null, hasDefault: row.has_default }))
                .sort((a, b) => a.name.localeCompare(b.name));

            const fromDrizzle = config.columns
                .map(column => ({ name: column.name, type: normalizeType(column.getSQLType()), notNull: column.notNull, hasDefault: column.hasDefault }))
                .sort((a, b) => a.name.localeCompare(b.name));

            expect(fromSql).toEqual(fromDrizzle);
        });

        it('has the same foreign keys, unique constraints and checks', async () => {
            const rows = await query<{ name: string, type: string, on_delete: string, foreign_table: string | null, def: string }>(`
                SELECT con.conname AS name, con.contype AS type, con.confdeltype AS on_delete, fc.relname AS foreign_table,
                    pg_get_constraintdef(con.oid) AS def
                FROM pg_constraint con
                JOIN pg_class c ON c.oid = con.conrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                LEFT JOIN pg_class fc ON fc.oid = con.confrelid
                WHERE n.nspname = $1 AND c.relname = $2 AND con.contype IN ('f', 'u', 'c')
            `, schema, config.name);

            const foreignKeysFromSql = rows.filter(row => row.type === 'f')
                .map(row => ({ name: row.name, foreignTable: row.foreign_table, onDelete: onDeleteCodes[row.on_delete] }))
                .sort((a, b) => a.name.localeCompare(b.name));
            const foreignKeysFromDrizzle = config.foreignKeys
                .map(fk => ({ name: fk.getName(), foreignTable: getTableConfig(fk.reference().foreignTable).name, onDelete: fk.onDelete ?? 'no action' }))
                .sort((a, b) => a.name.localeCompare(b.name));
            expect(foreignKeysFromSql).toEqual(foreignKeysFromDrizzle);

            const uniquesFromSql = rows.filter(row => row.type === 'u').map(row => row.name).sort();
            const uniquesFromDrizzle = [
                ...config.uniqueConstraints.map(unique => unique.getName()),
                ...config.columns.filter(column => column.isUnique).map(column => column.uniqueName!),
            ].sort();
            expect(uniquesFromSql).toEqual(uniquesFromDrizzle);

            const checksFromSql = rows.filter(row => row.type === 'c')
                .map(row => ({ name: row.name, values: quotedValues(row.def) }))
                .sort((a, b) => a.name.localeCompare(b.name));
            const checksFromDrizzle = config.checks
                .map(check => ({ name: check.name, values: quotedValues(dialect.sqlToQuery(check.value).sql) }))
                .sort((a, b) => a.name.localeCompare(b.name));
            expect(checksFromSql).toEqual(checksFromDrizzle);
        });

        it('has the same indexes', async () => {
            // Indexes that back a primary key or unique constraint are covered by the constraint check above.
            const rows = await query<{ name: string, is_unique: boolean, def: string }>(`
                SELECT i.relname AS name, ix.indisunique AS is_unique, pg_get_indexdef(ix.indexrelid) AS def
                FROM pg_index ix
                JOIN pg_class i ON i.oid = ix.indexrelid
                JOIN pg_class c ON c.oid = ix.indrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = $1 AND c.relname = $2
                    AND NOT EXISTS (SELECT 1 FROM pg_constraint con WHERE con.conindid = ix.indexrelid)
            `, schema, config.name);

            const fromSql = rows
                .map(row => ({
                    name: row.name,
                    unique: row.is_unique,
                    columns: normalizeExpression(row.def.substring(row.def.indexOf('USING btree (') + 'USING btree ('.length, row.def.lastIndexOf(')'))),
                }))
                .sort((a, b) => a.name.localeCompare(b.name));

            const fromDrizzle = config.indexes
                .map(index => ({
                    name: index.config.name!,
                    unique: index.config.unique,
                    columns: normalizeExpression(index.config.columns
                        .map(column => is(column, SQL) ? dialect.sqlToQuery(column).sql : (column as { name: string }).name)
                        .join(',')),
                }))
                .sort((a, b) => a.name.localeCompare(b.name));

            expect(fromSql).toEqual(fromDrizzle);
        });
    });
});
