import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { DateTimeUtil } from '@server/utility';

/** The `tx` a `transaction(async tx => ...)` callback receives, for helpers that write inside one. */
export type DbTransaction = Parameters<Parameters<NodePgDatabase['transaction']>[0]>[0];

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

    constructor(
        drizzleInstance: NodePgDatabase,
        private pool?: Pool
    ) {
        this.drizzle = drizzleInstance;
    }

    public static fromConfig(config: DatabaseClientConfig): DatabaseClient {
        // Fail a connection attempt after 5s instead of waiting forever (the pg default),
        // so requests and the health check report an unreachable database promptly.
        const pool = new Pool({ connectionTimeoutMillis: 5000, ...config });

        // An idle client can lose its connection (e.g. Postgres restarting). Without a listener,
        // the pool re-emits that as an unhandled 'error' event and the process exits.
        // The pool discards the broken client on its own; logging is all that's needed.
        pool.on('error', error => {
            console.error(
                `[${DateTimeUtil.getCurrentTimestamp()}] [ERROR] Postgres pool: idle client error: ${error.message}`
            );
        });

        return new DatabaseClient(drizzle(pool), pool);
    }

    /** Connects with the standard Postgres variables (`PGUSER`, `PGPASSWORD`, `PGHOST`, `PGDATABASE`, `PGPORT`). */
    public static fromEnvironment(env: NodeJS.ProcessEnv = process.env): DatabaseClient {
        return DatabaseClient.fromConfig({
            user: env.PGUSER || '',
            password: env.PGPASSWORD || '',
            host: env.PGHOST || 'localhost',
            database: env.PGDATABASE || '',
            port: parseInt(env.PGPORT || '5432')
        });
    }

    /** Runs a trivial query; throws if the database can't be reached. */
    public async ping(): Promise<void> {
        await this.drizzle.execute(sql`SELECT 1`);
    }

    /**
     * Applies the migrations in `migrationsFolder` that haven't run yet, each in its own transaction.
     * Drizzle records applied migrations in `drizzle.__drizzle_migrations`.
     */
    public async migrate(migrationsFolder: string): Promise<void> {
        await migrate(this.drizzle, { migrationsFolder });
    }

    /** Closes the pool once its checked-out clients are released. */
    public async close(): Promise<void> {
        await this.pool?.end();
    }
}
