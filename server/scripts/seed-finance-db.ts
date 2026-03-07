import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const dbConfig = {
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    database: process.env.PGDATABASE,
    port: parseInt(process.env.PGPORT || '5432'),
};

const pool = new Pool(dbConfig);

// Assuming structure: server/scripts/seed-finance-db.ts -> server/test-data/
const DATA_DIR = path.join(__dirname, './../test_data');

async function readCsv(fileName: string): Promise<string[]> {
    const filePath = path.join(DATA_DIR, fileName);
    const content = await fs.promises.readFile(filePath, 'utf-8');
    return content.split(/\r?\n/);
}

(async () => {
    const client = await pool.connect();
    try {
        console.log('🌱 Seeding finance data...');

        // 1. Create Finance Profile
        console.log(' 1. Inserting finance.profiles: one profile for demo user');
        await client.query(
            'INSERT INTO finance.profiles (id, user_id) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING',
            ['1', '1']
        );
        console.log(`✅ Seeded 1 finance.profile.`);

        // 2. Load Institutions
        console.log(' 2. Reading institutions.csv...');
        const institutionLines = await readCsv('institutions.csv');

        if (institutionLines.length > 0) {
            let count = 0;
            // Start at 1 to skip header row
            for (let i = 1; i < institutionLines.length; i++) {
                const line = institutionLines[i].trim();
                if (!line) {
                    continue;
                }
                
                const [id, profileId, name] = line.split(',');
                if (id && profileId && name) {
                    await client.query(
                        'INSERT INTO finance.institutions (id, profile_id, name) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING',
                        [id.trim(), profileId.trim(), name.trim()]
                    );
                    count++;
                }
            }
            console.log(`✅ Seeded ${count} finance.institutions.`);
        }

        // 3. Load Finance Accounts
        console.log(' 3. Reading accounts.csv...');
        const financeAccountLines = await readCsv('accounts.csv');
        if (financeAccountLines.length > 0) {
            let count = 0;
            // Start at 1 to skip header row
            for (let i = 1; i < financeAccountLines.length; i++) {
                const line = financeAccountLines[i].trim();
                if (!line) continue;
                const [id, profileId, institutionId, name, category, type, subtype, balance, hidden, retirement] = line.split(',');
                if (id && profileId && name) {
                    await client.query(
                        `INSERT INTO finance.accounts (
              id, profile_id, institution_id, name, category, type, subtype,
              balance, is_hidden, is_retirement
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (id) DO NOTHING`,
                        [
                            id.trim(),
                            profileId.trim(),
                            institutionId?.trim() || null,
                            name.trim(),
                            category.trim(),
                            type.trim(),
                            subtype?.trim() || null,
                            parseFloat(balance?.trim() || '0'),
                            hidden?.trim().toLowerCase() === 'true',
                            retirement?.trim().toLowerCase() === 'true'
                        ]
                    );
                    count++;
                }
            }
            console.log(`✅ Seeded ${count} finance.accounts.`);
        }
    }
    catch (err) {
        console.error('❌ Finance seeding failed:', err);
        process.exit(1);
    }
    finally {
        client.release();
        await pool.end();
    }
})();