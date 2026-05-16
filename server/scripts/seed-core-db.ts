import { Pool } from 'pg';
import bcrypt from 'bcrypt';
import { EntityIdPrefix } from '@shared/common/enum/entity-id-prefix';
import { EntityIdUtil } from './../src/core/utility/entity-id-util';

const dbConfig = {
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    port: parseInt(process.env.PGPORT || '5432'),
};

const pool = new Pool(dbConfig);

const { SEED_USER_USERNAME, SEED_USER_DISPLAY_NAME, SEED_USER_PASSWORD } = process.env;

if (!SEED_USER_USERNAME || !SEED_USER_DISPLAY_NAME || !SEED_USER_PASSWORD) {
    throw new Error('❌ Missing required environment variables: SEED_USER_USERNAME, SEED_USER_DISPLAY_NAME, or SEED_USER_PASSWORD must be defined in your .env file.');
}

(async () => {
    const client = await pool.connect();
    try {
        console.log('🌱 Seeding core data...');
        console.log(' 1. Inserting core.users: one demo user');

        const defaultHash = bcrypt.hashSync(SEED_USER_PASSWORD, 10);
        const userId = EntityIdUtil.generate(EntityIdPrefix.User);

        await client.query(
            'INSERT INTO core.users (id, display_name, username, password_hash) VALUES ($1, $2, $3, $4) ON CONFLICT (id) DO NOTHING',
            [
                userId,
                SEED_USER_DISPLAY_NAME,
                SEED_USER_USERNAME,
                defaultHash
            ]
        );
        console.log(`✅ Seeded 1 core.user (${SEED_USER_USERNAME}) with ID: ${userId}`);
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