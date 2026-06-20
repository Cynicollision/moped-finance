import { Pool, Client } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';

export interface IDatabaseClient {
    drizzle: NodePgDatabase;
}

export interface DatabaseClientConfig {
    user?: string;
    password?: string;
    host?: string;
    database?: string;
    port?: number;
}

export class DatabaseClient implements IDatabaseClient {
    public readonly drizzle: NodePgDatabase;

    constructor(drizzleInstance: NodePgDatabase) {
        this.drizzle = drizzleInstance;
    }

    public static fromConfig(config: DatabaseClientConfig): DatabaseClient {
        const pool = new Pool(config as any);
        return new DatabaseClient(drizzle(pool));
    }
}
