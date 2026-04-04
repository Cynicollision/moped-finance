import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { EntityIdUtil } from './../src/utility/entity-id';
import { EntityIdPrefix } from '@shared/core/enum/entity-id-prefix';

const dbConfig = {
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    port: parseInt(process.env.PGPORT || '5432'),
};

const pool = new Pool(dbConfig);

// Assuming structure: server/scripts/seed-grounds-db.ts -> server/test-data/
const DATA_DIR = path.join(__dirname, './../test_data');

async function readCsv(fileName: string): Promise<string[]> {
    const filePath = path.join(DATA_DIR, fileName);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return content.split(/\r?\n/);
}

(async () => {
    const client = await pool.connect();
    try {
        console.log('🌱 Seeding grounds data...');

        const { SEED_USER_USERNAME } = process.env;
        if (!SEED_USER_USERNAME) {
            throw new Error('❌ Missing required environment variable: SEED_USER_USERNAME must be defined in your .env file.');
        }

        const userResult = await client.query('SELECT id FROM core.users WHERE username = $1', [SEED_USER_USERNAME]);
        if (userResult.rows.length === 0) {
            throw new Error(`❌ Seed user "${SEED_USER_USERNAME}" not found in core.users. Please run seed-core-db.ts first.`);
        }
        const sampleUserId = userResult.rows[0].id;
        console.log(`👤 Using user ID: ${sampleUserId} (${SEED_USER_USERNAME})`);

        // Load Plant Varieties
        console.log(' 1. Reading plant_varieties.csv...');
        const varietyLines = await readCsv('plant_varieties.csv');

        if (varietyLines.length > 0) {
            let count = 0;
            // Start at 1 to skip header row
            for (let i = 1; i < varietyLines.length; i++) {
                const line = varietyLines[i].trim();
                if (!line) {
                    continue;
                }

                // CSV columns: Category, Common Name, Variety Name, Brand, Purchased From, Description
                const [category, commonName, varietyName, brand, purchasedFrom, description] = line.split(',');

                if (category && commonName) {
                    const generatedId = EntityIdUtil.generate(EntityIdPrefix.GroundsPlantVariety);

                    await client.query(
                        `INSERT INTO grounds.plant_varieties (
                            id, user_id, category, common_name, variety_name, brand_name, purchased_from, description
                         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                         ON CONFLICT (id) DO NOTHING`,
                        [
                            generatedId,
                            sampleUserId,
                            category.trim(),
                            commonName.trim(),
                            varietyName?.trim() || null,
                            brand?.trim() || null,
                            purchasedFrom?.trim() || null,
                            description?.trim() || null
                        ]
                    );
                    count++;
                }
            }
            console.log(`✅ Seeded ${count} grounds.plant_varieties.`);
        }

        console.log('✅ Grounds seeding completed.');
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

