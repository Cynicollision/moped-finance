import { Pool } from 'pg';
import { IDatabaseClient, IDatabaseResult } from './interfaces';

const dbConfig = {
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE,
    port: parseInt(process.env.PGPORT || '5432'),
};

export class PgDatabaseClient implements IDatabaseClient {
    private pool: Pool;

    constructor() {
        this.pool = new Pool(dbConfig);
    }

    public async query<T = any>(sql: string, params?: any[]): Promise<IDatabaseResult<T>> {
        const result = await this.pool.query(sql, params);
        return {
            rows: result.rows,
            rowCount: result.rowCount ?? null
        };
    }
}