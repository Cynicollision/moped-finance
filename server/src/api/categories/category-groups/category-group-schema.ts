import { sql } from 'drizzle-orm';
import { varchar, timestamp, check, uniqueIndex } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { CategoryClass } from '@shared/finance/enum';
import { financeSchema, SchemaUtil } from '@server/data';

export const categoryGroupSchema = financeSchema.table('category_groups', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    class: varchar('category_class', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
}, (table) => [
    check('category_groups_category_class_check', SchemaUtil.isOneOf(table.class, Object.values(CategoryClass))),
    uniqueIndex('category_groups_name_unique_idx').on(sql`lower(${table.name})`),
]);

export const createCategoryGroupSchema = createInsertSchema(categoryGroupSchema, {
    class: z.enum(CategoryClass),
    name: (schema) => schema.min(1).max(100),
}).pick({
    class: true,
    name: true,
});

export const updateCategoryGroupSchema = createCategoryGroupSchema.partial();

export type CreateCategoryGroupRequest = z.output<typeof createCategoryGroupSchema>;
export type UpdateCategoryGroupRequest = z.output<typeof updateCategoryGroupSchema>;
