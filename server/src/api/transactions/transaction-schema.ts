import { AnyPgColumn, pgSchema, varchar, timestamp, numeric, boolean, text, date, index } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { accountSchema } from './../accounts/account-schema';
import { categorySchema } from './../categories/category-schema';

const financeSchema = pgSchema('finance');

export const transactionSchema = financeSchema.table('transactions', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    accountId: varchar('account_id', { length: 50 }).notNull().references(() => accountSchema.id, { onDelete: 'cascade' }),
    // Nullable in the database (deleting a category leaves its transactions uncategorized), but required by the API.
    categoryId: varchar('category_id', { length: 50 }).references(() => categorySchema.id, { onDelete: 'set null' }),
    date: date('date', { mode: 'string' }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    merchant: varchar('merchant', { length: 255 }).notNull(),
    originalStatement: text('original_statement'),
    notes: text('notes'),
    isHidden: boolean('is_hidden').notNull().default(false),
    isSplit: boolean('is_split').notNull().default(false),
    splitParentId: varchar('split_parent_id', { length: 50 }).references((): AnyPgColumn => transactionSchema.id, { onDelete: 'restrict' }),
}, (table) => [
    index('transactions_date_idx').on(table.date),
    index('transactions_account_id_date_idx').on(table.accountId, table.date),
    index('transactions_category_id_idx').on(table.categoryId),
]);

export const createTransactionSchema = createInsertSchema(transactionSchema, {
    categoryId: z.string().min(1),
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
