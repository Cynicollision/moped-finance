import { sql } from 'drizzle-orm';
import { check, index, integer, numeric, timestamp, unique, uniqueIndex, varchar } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { RuleActionType, RuleConditionField, RuleOperator, TransactionDirection } from '@shared/finance/enum';
import { financeSchema, SchemaUtil } from '@server/data';
import { accountSchema } from './../accounts/account-schema';
import { categorySchema } from './../categories/category-schema';

// A rule's conditions and actions are rows of their own, rather than JSON, so the accounts and categories they name keep
// foreign keys, which stop those being deleted while a rule uses them (CAT-8.8).
export const ruleSchema = financeSchema.table(
    'rules',
    {
        id: varchar('id', { length: 50 }).primaryKey(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        name: varchar('name', { length: 100 }).notNull(),
        // The list order rules apply in, from 0 (CAT-8.3).
        position: integer('position').notNull()
    },
    table => [uniqueIndex('rules_name_unique_idx').on(sql`lower(${table.name})`)]
);

export const ruleConditionSchema = financeSchema.table(
    'rule_conditions',
    {
        id: varchar('id', { length: 50 }).primaryKey(),
        ruleId: varchar('rule_id', { length: 50 })
            .notNull()
            .references(() => ruleSchema.id, { onDelete: 'cascade' }),
        // The order the user gave them in.
        position: integer('position').notNull(),
        field: varchar('field', { length: 30 }).notNull(),
        operator: varchar('operator', { length: 30 }).notNull(),
        // Original Statement's and Merchant's term.
        textValue: varchar('text_value', { length: 255 }),
        // Amount's size (positive) and direction.
        amountValue: numeric('amount_value', { precision: 12, scale: 2, mode: 'number' }),
        direction: varchar('direction', { length: 10 }),
        // Account's account.
        accountId: varchar('account_id', { length: 50 }).references(() => accountSchema.id, { onDelete: 'restrict' })
    },
    table => [
        check('rule_conditions_field_check', SchemaUtil.isOneOf(table.field, Object.values(RuleConditionField))),
        check('rule_conditions_operator_check', SchemaUtil.isOneOf(table.operator, Object.values(RuleOperator))),
        check(
            'rule_conditions_direction_check',
            SchemaUtil.isOneOf(table.direction, Object.values(TransactionDirection))
        ),
        unique('rule_conditions_rule_id_field_unique').on(table.ruleId, table.field),
        index('rule_conditions_account_id_idx').on(table.accountId)
    ]
);

export const ruleActionSchema = financeSchema.table(
    'rule_actions',
    {
        id: varchar('id', { length: 50 }).primaryKey(),
        ruleId: varchar('rule_id', { length: 50 })
            .notNull()
            .references(() => ruleSchema.id, { onDelete: 'cascade' }),
        position: integer('position').notNull(),
        type: varchar('type', { length: 30 }).notNull(),
        // Set category's category.
        categoryId: varchar('category_id', { length: 50 }).references(() => categorySchema.id, {
            onDelete: 'restrict'
        }),
        // Rename merchant's new name.
        textValue: varchar('text_value', { length: 255 })
    },
    table => [
        check('rule_actions_type_check', SchemaUtil.isOneOf(table.type, Object.values(RuleActionType))),
        unique('rule_actions_rule_id_type_unique').on(table.ruleId, table.type),
        index('rule_actions_category_id_idx').on(table.categoryId)
    ]
);

// A term or name, without the surrounding spaces, which would only stop a match.
const ruleText = (maxLength: number) => z.string().trim().min(1).max(maxLength);

const conditionSchema = z.discriminatedUnion('field', [
    z.object({
        field: z.enum([RuleConditionField.OriginalStatement, RuleConditionField.Merchant]),
        operator: z.enum([RuleOperator.Contains, RuleOperator.Equals]),
        text: ruleText(255)
    }),
    z.object({
        field: z.literal(RuleConditionField.Amount),
        operator: z.enum([RuleOperator.GreaterThan, RuleOperator.LessThan, RuleOperator.Equals]),
        direction: z.enum(TransactionDirection),
        // Entered as a positive number beside Money out / Money in (CAT-8.1).
        amount: SchemaUtil.money().positive()
    }),
    z.object({
        field: z.literal(RuleConditionField.Account),
        accountId: z.string().min(1).max(50)
    })
]);

const actionSchema = z.discriminatedUnion('type', [
    z.object({ type: z.literal(RuleActionType.SetCategory), categoryId: z.string().min(1).max(50) }),
    z.object({ type: z.literal(RuleActionType.RenameMerchant), merchant: ruleText(255) })
]);

function isEachOnce<T>(values: T[]): boolean {
    return new Set(values).size === values.length;
}

export const createRuleSchema = createInsertSchema(ruleSchema, {
    name: schema => schema.min(1).max(100)
})
    .pick({ name: true })
    .extend({
        // One or more of each, each condition field and each action once (CAT-8.1).
        conditions: z
            .array(conditionSchema)
            .min(1)
            .refine(conditions => isEachOnce(conditions.map(c => c.field)), 'Each condition field can appear once'),
        actions: z
            .array(actionSchema)
            .min(1)
            .refine(actions => isEachOnce(actions.map(a => a.type)), 'Each action can appear once')
    });

// Conditions and actions sent replace the rule's own; those left out stay.
export const updateRuleSchema = createRuleSchema.partial();

// Every rule's ID, in the new order (CAT-8.3).
export const ruleOrderSchema = z.object({ ids: z.array(z.string().min(1).max(50)) });

export type CreateRuleRequest = z.output<typeof createRuleSchema>;
export type UpdateRuleRequest = z.output<typeof updateRuleSchema>;
export type RuleOrderRequest = z.output<typeof ruleOrderSchema>;
