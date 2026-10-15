import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AppSettings } from '@shared/core/types';
import { IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { DEFAULT_SETTINGS, settingFields, settingsSchema, UpdateSettingsRequest } from './settings-schema';

export interface ISettingsData {
    retrieve(): Promise<AppSettings>;
    update(changes: UpdateSettingsRequest): Promise<AppSettings>;
}

function isSettingKey(key: string): key is keyof AppSettings {
    return Object.prototype.hasOwnProperty.call(settingFields, key);
}

export class SettingsData implements ISettingsData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    /** Every setting: its stored value, or its default if it has none (or one that no longer fits its type). */
    public async retrieve(): Promise<AppSettings> {
        const rows = await this.db.select().from(settingsSchema);

        const settings: AppSettings = { ...DEFAULT_SETTINGS };
        for (const { key, value } of rows) {
            if (!isSettingKey(key)) {
                continue;
            }
            const parsed = settingFields[key].safeParse(value);
            if (parsed.success) {
                settings[key] = parsed.data;
            }
        }
        return settings;
    }

    /** Saves the settings in `changes`, in one statement; the others keep their values. */
    public async update(changes: UpdateSettingsRequest): Promise<AppSettings> {
        const now = DateTimeUtil.now();
        const rows = Object.entries(changes)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => ({ key, value, updatedAt: now }));

        if (rows.length > 0) {
            await this.db
                .insert(settingsSchema)
                .values(rows)
                .onConflictDoUpdate({
                    target: settingsSchema.key,
                    set: { value: sql`excluded.value`, updatedAt: now }
                });
        }

        return this.retrieve();
    }
}
