import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { AppSettings } from '@shared/core/types';
import { IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { settingsSchema, UpdateSettingsRequest } from './settings-schema';

export interface ISettingsData {
    retrieve(): Promise<AppSettings>;
    update(changes: UpdateSettingsRequest): Promise<AppSettings>;
}

const SETTINGS_ID = 1;

function mapRowToSettings(row: typeof settingsSchema.$inferSelect): AppSettings {
    return {
        showRetirementGroup: row.showRetirementGroup
    };
}

export class SettingsData implements ISettingsData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    /** The settings, creating the row with every setting's default the first time. */
    public async retrieve(): Promise<AppSettings> {
        await this.db.insert(settingsSchema).values({ id: SETTINGS_ID }).onConflictDoNothing();

        const rows = await this.db.select().from(settingsSchema).where(eq(settingsSchema.id, SETTINGS_ID));
        return mapRowToSettings(rows[0]);
    }

    /** Saves the settings in `changes`; the others keep their values. */
    public async update(changes: UpdateSettingsRequest): Promise<AppSettings> {
        const values = { ...changes, updatedAt: DateTimeUtil.now() };
        const rows = await this.db
            .insert(settingsSchema)
            .values({ id: SETTINGS_ID, ...values })
            .onConflictDoUpdate({ target: settingsSchema.id, set: values })
            .returning();

        return mapRowToSettings(rows[0]);
    }
}
