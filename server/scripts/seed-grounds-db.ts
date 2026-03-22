import { Pool } from 'pg';

const dbConfig = {
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    port: parseInt(process.env.PGPORT || '5432'),
};

const pool = new Pool(dbConfig);

(async () => {
    const client = await pool.connect();
    try {
        console.log('🌱 Seeding grounds data...');
        // TODO: Implement grounds seeding logic
        console.log('✅ Grounds seeding completed (placeholder).');
    }
    catch (err) {
        console.error('❌ Grounds seeding failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
})();
