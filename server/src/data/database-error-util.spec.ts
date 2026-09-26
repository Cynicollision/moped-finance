import { PGlite } from '@electric-sql/pglite';
import { TestDatabaseUtil } from '@server/utility/testing';
import { DatabaseErrorUtil } from './database-error-util';

describe('DatabaseErrorUtil', () => {
    let pglite: PGlite;

    beforeAll(async () => {
        pglite = (await TestDatabaseUtil.createMockDatabase()).pglite;
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    it('should find the Postgres error in a wrapped error', () => {
        const wrapped = { message: 'Failed query', cause: { code: '23505', constraint: 'categories_name_unique_idx' } };

        expect(DatabaseErrorUtil.getConstraintViolation(wrapped)).toEqual({ code: 'ALREADY_EXISTS', message: 'A category with that name already exists.' });
    });

    it('should ignore other database errors', () => {
        expect(DatabaseErrorUtil.getConstraintViolation({ code: '22003' })).toBeUndefined();
        expect(DatabaseErrorUtil.getConstraintViolation(new Error('boom'))).toBeUndefined();
    });

    it('APP-5.5 should fall back to a generic message when the foreign-key direction is unknown', () => {
        const result = DatabaseErrorUtil.getConstraintViolation({ code: '23503', constraint: 'categories_group_id_category_groups_id_fk', detail: 'Schlüssel …' });

        expect(result?.message).toBe('The request refers to a record that does not exist, or the record is still in use.');
    });

    // Adding a constraint without a message still works (it gets the generic one), but these keep the messages specific.
    it('should have a message for every unique constraint and index', async () => {
        const result = await pglite.query<{ name: string }>(`
            SELECT indexname AS name FROM pg_indexes
            WHERE schemaname IN ('core', 'finance') AND indexdef LIKE 'CREATE UNIQUE INDEX%' AND indexname NOT LIKE '%_pkey'
        `);
        expect(result.rows.length).toBeGreaterThan(0);

        for (const { name } of result.rows) {
            const violation = DatabaseErrorUtil.getConstraintViolation({ code: '23505', constraint: name });
            expect({ name, message: violation?.message }).not.toEqual({ name, message: 'A record with those values already exists.' });
        }
    });

    it('should have a missing-reference message for every foreign key, and a still-referenced message for every ON DELETE RESTRICT key', async () => {
        const result = await pglite.query<{ name: string, delete_rule: string }>(`
            SELECT constraint_name AS name, delete_rule FROM information_schema.referential_constraints
            WHERE constraint_schema IN ('core', 'finance')
        `);
        expect(result.rows.length).toBeGreaterThan(0);

        const generic = 'The request refers to a record that does not exist, or the record is still in use.';
        for (const { name, delete_rule } of result.rows) {
            const missing = DatabaseErrorUtil.getConstraintViolation({ code: '23503', constraint: name, detail: 'Key (id)=(x) is not present in table "t".' });
            expect({ name, message: missing?.message }).not.toEqual({ name, message: generic });

            if (delete_rule === 'RESTRICT') {
                const inUse = DatabaseErrorUtil.getConstraintViolation({ code: '23001', constraint: name });
                expect({ name, message: inUse?.message }).not.toEqual({ name, message: generic });
            }
            else if (delete_rule === 'NO ACTION') {
                const inUse = DatabaseErrorUtil.getConstraintViolation({ code: '23503', constraint: name, detail: 'Key (id)=(x) is still referenced from table "t".' });
                expect({ name, message: inUse?.message }).not.toEqual({ name, message: generic });
            }
        }
    });
});
