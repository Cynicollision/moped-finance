import { AnyColumn, SQL, sql } from 'drizzle-orm';

export class SchemaUtil {

    /**
     * Builds `column IN ('a', 'b', ...)` for a CHECK constraint that limits a column to an enum's values.
     */
    public static isOneOf(column: AnyColumn, values: string[]): SQL {
        const list = values.map(value => `'${value.replace(/'/g, "''")}'`).join(', ');
        return sql`${column} IN (${sql.raw(list)})`;
    }
}
