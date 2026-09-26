import { sql } from 'drizzle-orm';
import { pgSchema, varchar, timestamp, boolean, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { categoryGroupSchema } from './category-groups/category-group-schema';

const financeSchema = pgSchema('finance');

export const categorySchema = financeSchema.table('categories', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    groupId: varchar('group_id', { length: 50 }).notNull().references(() => categoryGroupSchema.id, { onDelete: 'restrict' }),
    icon: varchar('icon', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    isActive: boolean('is_active').notNull().default(true),
}, (table) => [
    uniqueIndex('categories_name_unique_idx').on(sql`lower(${table.name})`),
    index('categories_group_id_idx').on(table.groupId),
]);

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
