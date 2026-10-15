import { varchar, timestamp, numeric, boolean, text, date, index, integer } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { TransactionSplit } from '@shared/finance/util';
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
        // The parts of a split transaction share a split ID, and are in order by position (TXN-4). Both are null for a
        // transaction that isn't split.
        splitId: varchar('split_id', { length: 50 }),
        splitPosition: integer('split_position')
    },
    table => [
        index('transactions_date_idx').on(table.date),
        index('transactions_account_id_date_idx').on(table.accountId, table.date),
        index('transactions_category_id_idx').on(table.categoryId),
        index('transactions_split_id_idx').on(table.splitId)
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
    adjustsBalance: z.boolean().optional()
}).pick({
    accountId: true,
    categoryId: true,
    date: true,
    amount: true,
    merchant: true,
    originalStatement: true,
    notes: true,
    isHidden: true,
    adjustsBalance: true
});

// A transaction is split, and its parts changed, only through the split endpoints.
export const updateTransactionSchema = createTransactionSchema.partial();

// A part's amount is signed like the transaction's, so it can't be 0 (TXN-4.2).
export const splitTransactionSchema = z.object({
    parts: z
        .array(
            createTransactionSchema.pick({ categoryId: true, merchant: true, notes: true }).extend({
                id: z.string().min(1).max(50).optional(),
                amount: SchemaUtil.money().refine(v => v !== 0, "Can't be 0")
            })
        )
        .min(TransactionSplit.minParts)
        .max(TransactionSplit.maxParts)
});

export type CreateTransactionRequest = z.output<typeof createTransactionSchema>;
export type UpdateTransactionRequest = z.output<typeof updateTransactionSchema>;
export type SplitTransactionRequest = z.output<typeof splitTransactionSchema>;
