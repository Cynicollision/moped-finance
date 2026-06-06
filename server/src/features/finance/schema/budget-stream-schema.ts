import { pgSchema, varchar, timestamp, decimal } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

const financeSchema = pgSchema('finance');

export const budgetStreamSchema = financeSchema.table('budget_streams', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    userId: varchar('user_id', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    categoryId: varchar('category_id', { length: 50 }),
    type: varchar('type', { length: 50 }).notNull(),
    recurrence: varchar('recurrence', { length: 50 }).notNull(),
    amount: decimal('amount', { precision: 12, scale: 2 }).notNull(),
});

// Validation — auto-derived from the Drizzle table definition.
// Pick only user-supplied fields (server generates id, timestamps, userId).
export const createBudgetStreamSchema = createInsertSchema(budgetStreamSchema, {
    name: (schema) => schema.min(1).max(100),
    categoryId: (schema) => schema.min(1),
    amount: z.number().finite(),
}).pick({ name: true, categoryId: true, type: true, recurrence: true, amount: true });

export const updateBudgetStreamSchema = createBudgetStreamSchema.partial();