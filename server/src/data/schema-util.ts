import { AnyColumn, SQL, sql } from 'drizzle-orm';
import { z } from 'zod';

export class SchemaUtil {

    /** Largest absolute value a `DECIMAL(12, 2)` money column holds. */
    public static readonly maxMoneyAmount = 9_999_999_999.99;

    /**
     * Builds `column IN ('a', 'b', ...)` for a CHECK constraint that limits a column to an enum's values.
     */
    public static isOneOf(column: AnyColumn, values: string[]): SQL {
        const list = values.map(value => `'${value.replace(/'/g, "''")}'`).join(', ');
        return sql`${column} IN (${sql.raw(list)})`;
    }

    /** Request schema for a money amount: a finite number that fits a `DECIMAL(12, 2)` column. */
    public static money() {
        return z.number().finite().min(-SchemaUtil.maxMoneyAmount).max(SchemaUtil.maxMoneyAmount);
    }

    /**
     * Request schema for optional text that the API represents as '' when empty (the database stores NULL).
     * Missing, null and '' all parse to ''; on a `.partial()` update schema, a missing field stays missing.
     */
    public static optionalText(maxLength?: number) {
        const text = maxLength === undefined ? z.string() : z.string().max(maxLength);
        return text.nullish().transform(v => v ?? '');
    }

    /** Request schema for a `date` column: any string `Date` can parse, such as YYYY-MM-DD or an ISO timestamp. */
    public static date() {
        return z.string().refine(v => !Number.isNaN(Date.parse(v)), 'Invalid date');
    }
}
