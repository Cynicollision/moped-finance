import { varchar, timestamp, decimal, check, index } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { CalendarPeriod } from '@shared/core/enum';
import { financeSchema, SchemaUtil } from '@server/data';
import { categorySchema } from './../categories/category-schema';

export const budgetStreamSchema = financeSchema.table(
    'budget_streams',
    {
        id: varchar('id', { length: 50 }).primaryKey(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        name: varchar('name', { length: 100 }).notNull(),
        // The stream's type follows from its category's class (BUD-1.1), so a category in use can't be deleted (CAT-4.5).
        categoryId: varchar('category_id', { length: 50 })
            .notNull()
            .references(() => categorySchema.id, { onDelete: 'restrict' }),
        recurrence: varchar('recurrence', { length: 50 }).notNull(),
        amount: decimal('amount', { precision: 12, scale: 2 }).notNull()
    },
    table => [
        check('budget_streams_recurrence_check', SchemaUtil.isOneOf(table.recurrence, Object.values(CalendarPeriod))),
        index('budget_streams_category_id_idx').on(table.categoryId)
    ]
);

// Validation — auto-derived from the Drizzle table definition.
// Pick only user-supplied fields (server generates id and timestamps, and the type comes from the category).
export const createBudgetStreamSchema = createInsertSchema(budgetStreamSchema, {
    name: schema => schema.min(1).max(100),
    categoryId: z.string().min(1),
    recurrence: z.enum(CalendarPeriod),
    amount: SchemaUtil.money().min(0)
}).pick({ name: true, categoryId: true, recurrence: true, amount: true });

export const updateBudgetStreamSchema = createBudgetStreamSchema.partial();

export type CreateBudgetStreamRequest = z.output<typeof createBudgetStreamSchema>;
export type UpdateBudgetStreamRequest = z.output<typeof updateBudgetStreamSchema>;
