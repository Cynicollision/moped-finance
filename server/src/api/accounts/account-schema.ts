import { varchar, timestamp, boolean, check, index } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';
import { financeSchema, SchemaUtil } from '@server/data';
import { institutionSchema } from './../institutions/institution-schema';

export const accountSchema = financeSchema.table('accounts', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    institutionId: varchar('institution_id', { length: 50 }).notNull().references(() => institutionSchema.id, { onDelete: 'restrict' }),
    name: varchar('name', { length: 100 }).notNull(),
    category: varchar('account_category', { length: 50 }).notNull(),
    group: varchar('account_group', { length: 50 }).notNull(),
    // Nullable: some groups (e.g. Credit Card) have no account types.
    type: varchar('account_type', { length: 50 }),
    isHidden: boolean('is_hidden').notNull().default(false),
    isManual: boolean('is_manual').notNull().default(false),
    isRetirement: boolean('is_retirement').notNull().default(false),
    hideFromSpending: boolean('hide_from_spending').notNull().default(false),
}, (table) => [
    check('accounts_account_category_check', SchemaUtil.isOneOf(table.category, Object.values(AccountCategory))),
    check('accounts_account_group_check', SchemaUtil.isOneOf(table.group, Object.values(AccountGroup))),
    check('accounts_account_type_check', SchemaUtil.isOneOf(table.type, Object.values(AccountType))),
    index('accounts_institution_id_idx').on(table.institutionId),
]);

export const createAccountSchema = createInsertSchema(accountSchema, {
    name: (schema) => schema.min(1).max(100),
    category: z.enum(AccountCategory),
    group: z.enum(AccountGroup),
    type: z.enum(AccountType).nullish(),
    institutionId: (schema) => schema.min(1),
    isHidden: z.boolean().optional(),
    isManual: z.boolean().optional(),
    isRetirement: z.boolean().optional(),
    hideFromSpending: z.boolean().optional(),
}).pick({
    name: true,
    institutionId: true,
    category: true,
    group: true,
    type: true,
    isHidden: true,
    isManual: true,
    isRetirement: true,
    hideFromSpending: true,
});

export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccountRequest = z.output<typeof createAccountSchema>;
export type UpdateAccountRequest = z.output<typeof updateAccountSchema>;
