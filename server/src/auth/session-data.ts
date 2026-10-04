import { index, json, timestamp, varchar } from 'drizzle-orm/pg-core';
import { coreSchema } from '@server/data';

// Sessions (AUTH-3.6). connect-pg-simple reads and writes this table itself; the columns are the ones it expects.
export const sessionSchema = coreSchema.table(
    'sessions',
    {
        sid: varchar('sid').primaryKey(),
        sess: json('sess').notNull(),
        expire: timestamp('expire', { precision: 6, withTimezone: true }).notNull()
    },
    table => [index('sessions_expire_idx').on(table.expire)]
);
