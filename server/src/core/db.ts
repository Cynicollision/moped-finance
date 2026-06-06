import { Pool } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IDatabaseClient, IDatabaseResult } from './interfaces';

const dbConfig = {
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE,
    port: parseInt(process.env.PGPORT || '5432'),
};

export class DatabaseClient implements IDatabaseClient {
    public readonly pool: Pool; // TODO (Remove Post-Grounds): may no longer need to expose this after full ORM conversion
    public readonly drizzle: NodePgDatabase;

    constructor() {
        this.pool = new Pool(dbConfig);
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
