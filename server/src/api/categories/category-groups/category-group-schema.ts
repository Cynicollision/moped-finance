import { pgSchema, varchar, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

const financeSchema = pgSchema('finance');

export const categoryGroupSchema = financeSchema.table('category_groups', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    class: varchar('category_class', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
});

export const createCategoryGroupSchema = createInsertSchema(categoryGroupSchema, {
    class: (schema) => schema.min(1),
    name: (schema) => schema.min(1).max(100),
}).pick({
    class: true,
    name: true,
});

export const updateCategoryGroupSchema = createCategoryGroupSchema.partial();
