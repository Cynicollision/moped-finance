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
        console.log('🗑️  Dropping finance schema...');
        await client.query('DROP SCHEMA IF EXISTS finance CASCADE;');
        console.log('✅ Finance schema dropped.');
    }
    catch (err) {
        console.error('❌ Finance reset failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
})();