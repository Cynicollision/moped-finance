import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { pgSchema, varchar, timestamp, text } from 'drizzle-orm/pg-core';
import { LogEntry } from '@shared/core/types';
import { IDatabaseClient } from '@server-core/data';

const coreSchema = pgSchema('core');

const logSchema = coreSchema.table('logs', {
    id: varchar('id', { length: 50 }).primaryKey(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    userId: varchar('user_id', { length: 50 }).notNull(),
    level: varchar('level', { length: 50 }).notNull(),
    context: varchar('context', { length: 255 }).notNull(),
    message: text('message').notNull()
});

export interface ILogData {
    create(log: LogEntry): Promise<void>;
}

export class LogData implements ILogData {
    private db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async create(log: LogEntry): Promise<void> {
        await this.db.insert(logSchema)
            .values({
                id: log.id,
                userId: log.contextUserId,
                level: log.level,
                context: log.context,
                message: log.message
            });
    }
}
