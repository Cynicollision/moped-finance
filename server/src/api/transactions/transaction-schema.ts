import { AnyPgColumn, varchar, timestamp, numeric, boolean, text, date, index } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { financeSchema, SchemaUtil } from '@server/data';
import { accountSchema } from './../accounts/account-schema';
import { categorySchema } from './../categories/category-schema';

export const transactionSchema = financeSchema.table(
    'transactions',
    {
        id: varchar('id', { length: 50 }).primaryKey(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        accountId: varchar('account_id', { length: 50 })
            .notNull()
            .references(() => accountSchema.id, { onDelete: 'cascade' }),
        // Null when the transaction is Uncategorized (CAT-5). Deleting a category leaves its transactions uncategorized.
        categoryId: varchar('category_id', { length: 50 }).references(() => categorySchema.id, {
            onDelete: 'set null'
        }),
        date: date('date', { mode: 'string' }).notNull(),
        amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
        merchant: varchar('merchant', { length: 255 }).notNull(),
        originalStatement: text('original_statement'),
        notes: text('notes'),
        isHidden: boolean('is_hidden').notNull().default(false),
        // Changes the account's balance history while it isn't hidden (ACCT-5.2, TXN-2.10).
        adjustsBalance: boolean('adjusts_balance').notNull().default(false),
        isSplit: boolean('is_split').notNull().default(false),
        splitParentId: varchar('split_parent_id', { length: 50 }).references((): AnyPgColumn => transactionSchema.id, {
            onDelete: 'restrict'
        })
    },
    table => [
        index('transactions_date_idx').on(table.date),
        index('transactions_account_id_date_idx').on(table.accountId, table.date),
        index('transactions_category_id_idx').on(table.categoryId)
    ]
);

export const createTransactionSchema = createInsertSchema(transactionSchema, {
    // Blank or left out: Uncategorized (CAT-5.2).
    categoryId: SchemaUtil.optionalText(50),
    date: SchemaUtil.recordDate(),
    amount: SchemaUtil.money(),
    merchant: schema => schema.min(1).max(255),
    originalStatement: SchemaUtil.optionalText(),
    notes: SchemaUtil.optionalText(),
    isHidden: z.boolean().optional(),
    adjustsBalance: z.boolean().optional(),
    isSplit: z.boolean().optional(),
    splitParentId: SchemaUtil.optionalText(50)
}).pick({
    accountId: true,
    categoryId: true,
    date: true,
    amount: true,
    merchant: true,
    originalStatement: true,
    notes: true,
    isHidden: true,
    adjustsBalance: true,
    isSplit: true,
    splitParentId: true
});

// Split fields can't be changed after creation.
export const updateTransactionSchema = createTransactionSchema
    .omit({
        isSplit: true,
        splitParentId: true
    })
    .partial();

export type CreateTransactionRequest = z.output<typeof createTransactionSchema>;
export type UpdateTransactionRequest = z.output<typeof updateTransactionSchema>;
