import { Pool } from 'pg';

const dbConfig = {
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE,
    port: parseInt(process.env.PGPORT || '5432'),
};

const pool = new Pool(dbConfig);

(async () => {
    const client = await pool.connect();
    try {
        // `drizzle` holds the record of applied migrations; dropping it lets db:migrate start from scratch.
        console.log('🗑️  Dropping core, finance and drizzle schemas...');
        await client.query('DROP SCHEMA IF EXISTS core, finance, drizzle CASCADE;');
        console.log('✅ Schemas dropped.');
    }
    catch (err) {
        console.error('❌ Drop failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
})();
