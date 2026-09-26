import { pgSchema, varchar, timestamp, numeric, date, index, unique } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { accountSchema } from './account-schema';

const financeSchema = pgSchema('finance');

export const balanceHistorySchema = financeSchema.table('balance_history', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    accountId: varchar('account_id', { length: 50 }).notNull().references(() => accountSchema.id, { onDelete: 'cascade' }),
    date: date('date', { mode: 'string' }).notNull(),
    balance: numeric('balance', { precision: 12, scale: 2 }).notNull(),
}, (table) => [
    unique('balance_history_account_id_date_unique').on(table.accountId, table.date),
    index('balance_history_date_idx').on(table.date),
]);

export const createBalanceHistorySchema = createInsertSchema(balanceHistorySchema).pick({
    accountId: true,
    date: true,
    balance: true,
});
