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
        const bcrypt = require('bcrypt');
        const defaultHash = bcrypt.hashSync('password', 10);
        await client.query(
            'INSERT INTO core.users (id, name, username, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
            ['1', 'Sean', 'stn', defaultHash]
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