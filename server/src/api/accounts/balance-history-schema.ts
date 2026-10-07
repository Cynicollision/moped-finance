import { varchar, timestamp, numeric, date, index, unique, check } from 'drizzle-orm/pg-core';
import { BalanceEntrySource } from '@shared/finance/enum';
import { financeSchema, SchemaUtil } from '@server/data';
import { accountSchema } from './account-schema';

export const balanceHistorySchema = financeSchema.table(
    'balance_history',
    {
        id: varchar('id', { length: 50 }).primaryKey(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        accountId: varchar('account_id', { length: 50 })
            .notNull()
            .references(() => accountSchema.id, { onDelete: 'cascade' }),
        date: date('date', { mode: 'string' }).notNull(),
        balance: numeric('balance', { precision: 12, scale: 2 }).notNull(),
        // Set entries are checkpoints; adjusted ones exist only because of transactions (ACCT-5.1).
        source: varchar('source', { length: 20 }).notNull().default(BalanceEntrySource.Set)
    },
    table => [
        check('balance_history_source_check', SchemaUtil.isOneOf(table.source, Object.values(BalanceEntrySource))),
        unique('balance_history_account_id_date_unique').on(table.accountId, table.date),
        index('balance_history_date_idx').on(table.date)
    ]
);
