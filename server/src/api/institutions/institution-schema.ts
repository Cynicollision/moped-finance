import { pgSchema, varchar, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';

const financeSchema = pgSchema('finance');

export const institutionSchema = financeSchema.table('institutions', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    name: varchar('name', { length: 100 }).notNull(),
});

export const createInstitutionSchema = createInsertSchema(institutionSchema, {
    name: (schema) => schema.min(1).max(100),
}).pick({
    name: true,
});

export const updateInstitutionSchema = createInstitutionSchema.partial();
