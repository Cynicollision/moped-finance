import { randomBytes } from 'crypto';
import { eq } from 'drizzle-orm';
import { text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { coreSchema, IDatabaseClient } from '@server/data';

// Secrets the server generates for itself, such as the session secret (AUTH-3.7).
export const secretSchema = coreSchema.table('secrets', {
    name: varchar('name', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    value: text('value').notNull()
});

export class SecretData {
    private db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    /**
     * Returns the secret stored under `name`, generating and storing a random one (32 bytes) the first time.
     * Safe to call from two servers starting at once: both get the value that was stored first.
     */
    public async retrieveOrCreate(name: string): Promise<string> {
        await this.db.insert(secretSchema)
            .values({ name, value: randomBytes(32).toString('base64url') })
            .onConflictDoNothing();

        const rows = await this.db.select({ value: secretSchema.value })
            .from(secretSchema)
            .where(eq(secretSchema.name, name));

        return rows[0].value;
    }
}
