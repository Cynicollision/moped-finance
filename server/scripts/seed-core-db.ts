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
        console.log('🌱 Seeding core data...');
        console.log(' 1. Inserting core.users: one demo user');
        await client.query(
            'INSERT INTO core.users (id, name, username) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
            ['1', 'Sean', 'stn']
        );
        console.log(`✅ Seeded 1 core.user.`);
    }
    catch (err) {
        console.error('❌ Core seeding failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
})();