import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { CoreEntityIdPrefix, EntityId } from '@server/data';

const dbConfig = {
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    port: parseInt(process.env.PGPORT || '5432')
};

const pool = new Pool(dbConfig);

const { SEED_USER_USERNAME, SEED_USER_DISPLAY_NAME, SEED_USER_PASSWORD } = process.env;

if (!SEED_USER_USERNAME || !SEED_USER_DISPLAY_NAME || !SEED_USER_PASSWORD) {
    throw new Error(
        '❌ Missing required environment variables: SEED_USER_USERNAME, SEED_USER_DISPLAY_NAME, or SEED_USER_PASSWORD must be defined in your .env file.'
    );
}

(async () => {
    const client = await pool.connect();
    try {
        console.log('🌱 Seeding core data...');
        console.log(' 1. Inserting core.users: one demo user');

        const defaultHash = bcrypt.hashSync(SEED_USER_PASSWORD, 10);
        const userId = EntityId.generate(CoreEntityIdPrefix.User);

        // An instance has one user (AUTH-7.2), so there's nothing to add once one exists.
        const result = await client.query(
            'INSERT INTO core.users (id, display_name, username, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING',
            [userId, SEED_USER_DISPLAY_NAME, SEED_USER_USERNAME, defaultHash]
        );
        if (result.rowCount) {
            console.log(`✅ Seeded 1 core.user (${SEED_USER_USERNAME}) with ID: ${userId}`);
        } else {
            console.log('⏭️  A user already exists; skipped.');
        }
    } catch (err) {
        console.error('❌ Core seeding failed:', err);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
})();
