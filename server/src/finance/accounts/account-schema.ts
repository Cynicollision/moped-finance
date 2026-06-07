import { pgSchema, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

const financeSchema = pgSchema('finance');

export const accountSchema = financeSchema.table('accounts', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    userId: varchar('user_id', { length: 50 }).notNull(),
    institutionId: varchar('institution_id', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    category: varchar('account_category', { length: 50 }).notNull(),
    group: varchar('account_group', { length: 50 }).notNull(),
    type: varchar('account_type', { length: 50 }).notNull(),
    isHidden: boolean('is_hidden').notNull().default(false),
    isManual: boolean('is_manual').notNull().default(false),
    isRetirement: boolean('is_retirement').notNull().default(false),
    hideFromCashflow: boolean('hide_from_cashflow').notNull().default(false),
});

export const createAccountSchema = createInsertSchema(accountSchema, {
    name: (schema) => schema.min(1).max(100),
    category: (schema) => schema.min(1),
    group: (schema) => schema.min(1),
    institutionId: (schema) => schema.min(1).nullable(),
    type: (schema) => schema.nullable(),
    isHidden: z.boolean().optional(),
    isManual: z.boolean().optional(),
    isRetirement: z.boolean().optional(),
    hideFromCashflow: z.boolean().optional(),
}).pick({
    name: true,
    institutionId: true,
    category: true,
    group: true,
    type: true,
    isHidden: true,
    isManual: true,
    isRetirement: true,
    hideFromCashflow: true,
});

export const updateAccountSchema = createAccountSchema.partial();
