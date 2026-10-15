import { sql } from 'drizzle-orm';
import { boolean, check, integer, timestamp } from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';
import { coreSchema } from '@server/data';

// The instance's settings (SET-1.2): a single row, whose column defaults are the settings' defaults.
// Add a setting as a column with a default.
export const settingsSchema = coreSchema.table(
    'settings',
    {
        id: integer('id').primaryKey().default(1),
        updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
        showRetirementGroup: boolean('show_retirement_group').notNull().default(true)
    },
    table => [check('settings_single_row', sql`${table.id} = 1`)]
);

export const updateSettingsSchema = createInsertSchema(settingsSchema)
    .pick({
        showRetirementGroup: true
    })
    .partial();

export type UpdateSettingsRequest = z.output<typeof updateSettingsSchema>;
