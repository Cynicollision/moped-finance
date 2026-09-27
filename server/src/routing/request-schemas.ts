import { z } from 'zod';
import { SchemaUtil } from '@server/data';

/** Route params for `/:id` routes. */
export const idParamsSchema = z.object({
    id: z.string().min(1)
});

/** Query-string fields, which always arrive as strings. */
export class QueryField {
    /** `true` or `false`, parsed to a boolean. */
    public static boolean() {
        return z.enum(['true', 'false']).transform(v => v === 'true');
    }

    /** A calendar date written YYYY-MM-DD, as `SchemaUtil.date()`; anything else is a 400. */
    public static date() {
        return SchemaUtil.date();
    }
}
