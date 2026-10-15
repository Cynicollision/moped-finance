import { jsonb, timestamp, varchar } from 'drizzle-orm/pg-core';
import { z } from 'zod';
import { AppTheme } from '@shared/core/enum';
import { AppSettings } from '@shared/core/types';
import { coreSchema } from '@server/data';

// The instance's settings (SET-1.2): one row per setting the user has changed, its value stored as JSON.
// A setting with no row has its default, so adding a setting needs no migration: add it to AppSettings,
// settingFields and DEFAULT_SETTINGS.
export const settingsSchema = coreSchema.table('settings', {
    key: varchar('key', { length: 100 }).primaryKey(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    value: jsonb('value').notNull()
});

/** Each setting's type. A stored value that no longer fits is ignored in favour of the default. */
export const settingFields = {
    theme: z.enum(AppTheme),
    showRetirementGroup: z.boolean()
} satisfies { [K in keyof AppSettings]: z.ZodType<AppSettings[K]> };

export const DEFAULT_SETTINGS: AppSettings = {
    theme: AppTheme.Dark,
    showRetirementGroup: true
};

// Defaults stay out of the schema: Zod 4 would fill them in for settings that aren't sent, overwriting stored ones.
export const updateSettingsSchema = z.object(settingFields).partial();

export type UpdateSettingsRequest = z.output<typeof updateSettingsSchema>;
