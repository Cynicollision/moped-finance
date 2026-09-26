import { z } from 'zod';

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

    /** Any date string `Date` can parse, parsed to a `Date`; anything else is a 400 rather than an Invalid Date. */
    public static date() {
        return z.coerce.date();
    }
}
