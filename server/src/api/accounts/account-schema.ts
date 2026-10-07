import { varchar, timestamp, boolean, check, index } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { AccountType } from '@shared/finance/enum';
import { financeSchema, SchemaUtil } from '@server/data';
import { institutionSchema } from './../institutions/institution-schema';

export const accountSchema = financeSchema.table(
    'accounts',
    {
        id: varchar('id', { length: 50 }).primaryKey(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        institutionId: varchar('institution_id', { length: 50 })
            .notNull()
            .references(() => institutionSchema.id, { onDelete: 'restrict' }),
        name: varchar('name', { length: 100 }).notNull(),
        // The group and Asset/Liability follow from the type (AccountTypeUtil), so they aren't stored.
        type: varchar('account_type', { length: 50 }).notNull(),
        isHidden: boolean('is_hidden').notNull().default(false),
        isManual: boolean('is_manual').notNull().default(false),
        hideFromSpending: boolean('hide_from_spending').notNull().default(false)
    },
    table => [
        check('accounts_account_type_check', SchemaUtil.isOneOf(table.type, Object.values(AccountType))),
        index('accounts_institution_id_idx').on(table.institutionId)
    ]
);

export const createAccountSchema = createInsertSchema(accountSchema, {
    name: schema => schema.min(1).max(100),
    type: z.enum(AccountType),
    institutionId: schema => schema.min(1),
    isHidden: z.boolean().optional(),
    isManual: z.boolean().optional(),
    hideFromSpending: z.boolean().optional()
}).pick({
    name: true,
    institutionId: true,
    type: true,
    isHidden: true,
    isManual: true,
    hideFromSpending: true
});

export const updateAccountSchema = createAccountSchema.partial();

export type CreateAccountRequest = z.output<typeof createAccountSchema>;
export type UpdateAccountRequest = z.output<typeof updateAccountSchema>;
