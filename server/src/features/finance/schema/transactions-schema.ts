import { pgSchema, varchar, timestamp, numeric, boolean, text, date } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

const financeSchema = pgSchema('finance');

export const transactionSchema = financeSchema.table('transactions', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    accountId: varchar('account_id', { length: 50 }).notNull(),
    categoryId: varchar('category_id', { length: 50 }).notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    amount: numeric('amount').notNull(),
    merchant: varchar('merchant', { length: 255 }).notNull(),
    originalStatement: varchar('original_statement', { length: 255 }),
    notes: text('notes'),
    isHidden: boolean('is_hidden').notNull().default(false),
    isSplit: boolean('is_split').notNull().default(false),
    splitParentId: varchar('split_parent_id', { length: 50 }),
});

export const createTransactionSchema = createInsertSchema(transactionSchema, {
    amount: z.number().finite(),
    merchant: (schema) => schema.min(1).max(255),
    isHidden: z.boolean().optional(),
    isSplit: z.boolean().optional(),
}).pick({
    accountId: true,
    categoryId: true,
    date: true,
    amount: true,
    merchant: true,
    originalStatement: true,
    notes: true,
    isHidden: true,
    isSplit: true,
    splitParentId: true,
});

export const updateTransactionSchema = createTransactionSchema.partial();
