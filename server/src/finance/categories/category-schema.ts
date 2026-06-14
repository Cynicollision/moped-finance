import { pgSchema, varchar, timestamp, boolean } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

const financeSchema = pgSchema('finance');

export const categorySchema = financeSchema.table('categories', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    userId: varchar('user_id', { length: 50 }).notNull(),
    groupId: varchar('group_id', { length: 50 }).notNull(),
    icon: varchar('icon', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
});

export const createCategorySchema = createInsertSchema(categorySchema, {
    groupId: (schema) => schema.min(1),
    icon: (schema) => schema.min(1),
    name: (schema) => schema.min(1).max(100),
    isActive: z.boolean().optional(),
}).pick({
    groupId: true,
    icon: true,
    name: true,
    isActive: true,
});

export const updateCategorySchema = createCategorySchema.partial();
