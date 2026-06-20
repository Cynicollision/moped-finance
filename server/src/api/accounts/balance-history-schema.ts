import { pgSchema, varchar, timestamp, numeric, date } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

const financeSchema = pgSchema('finance');

export const balanceHistorySchema = financeSchema.table('balance_history', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    userId: varchar('user_id', { length: 50 }).notNull(),
    accountId: varchar('account_id', { length: 50 }).notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    balance: numeric('balance').notNull(),
});

export const createBalanceHistorySchema = createInsertSchema(balanceHistorySchema).pick({
    accountId: true,
    date: true,
    balance: true,
});
