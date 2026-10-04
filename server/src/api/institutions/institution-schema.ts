import { sql } from 'drizzle-orm';
import { varchar, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { financeSchema } from '@server/data';

export const institutionSchema = financeSchema.table(
    'institutions',
    {
        id: varchar('id', { length: 50 }).primaryKey(),
        createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        name: varchar('name', { length: 100 }).notNull()
    },
    table => [uniqueIndex('institutions_name_unique_idx').on(sql`lower(${table.name})`)]
);

export const createInstitutionSchema = createInsertSchema(institutionSchema, {
    name: schema => schema.min(1).max(100)
}).pick({
    name: true
});

export const updateInstitutionSchema = createInstitutionSchema.partial();

export type CreateInstitutionRequest = z.output<typeof createInstitutionSchema>;
export type UpdateInstitutionRequest = z.output<typeof updateInstitutionSchema>;
