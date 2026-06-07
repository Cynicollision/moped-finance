import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IDatabaseClient, IDatabaseResult } from './interfaces';

export interface DatabaseClientConfig {
    user: string;
    password: string;
    host: string;
    database: string;
    port: number;
}

export class DatabaseClient implements IDatabaseClient {
    private readonly pool: Pool;
    public readonly drizzle: NodePgDatabase;

    constructor(config: DatabaseClientConfig) {
        this.pool = new Pool(config);
        this.drizzle = drizzle(this.pool);
    }

    // Backward-compat for modules still using raw SQL - TODO (Remove Post-Grounds): phase out raw queries
    public async query<T = any>(sql: string, params?: any[]): Promise<IDatabaseResult<T>> {
        const result = await this.pool.query(sql, params);
        return {
            rows: result.rows,
            rowCount: result.rowCount ?? null
        };
    }
}
