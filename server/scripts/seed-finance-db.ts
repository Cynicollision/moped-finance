import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { generateEntityId } from '../src/utility/id-util';
import { EntityIdPrefix } from '@shared/core/enum/entity-id-prefix';


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

        const sampleUserId = '1';
        const sampleProfileId = '1';

        // 1. Create Finance Profile
        console.log(' 1. Inserting finance.profiles: one profile for demo user');
        await client.query(
            `INSERT INTO finance.profiles (id, user_id) 
             VALUES ($1, $2) 
             ON CONFLICT (id) DO NOTHING`,
            [sampleProfileId, sampleUserId]
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
                        `INSERT INTO finance.institutions (id, profile_id, name) 
                         VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
                        [id.trim(), profileId.trim(), name.trim()]
                    );
                    count++;
                }
            }
            console.log(`✅ Seeded ${count} finance.institutions.`);
        }

        // 3. Load Finance Accounts
        const accountsMap = new Map<string, string>();

        console.log(' 3. Reading accounts.csv...');
        const accountsLines = await readCsv('accounts.csv');
        if (accountsLines.length > 0) {
            let count = 0;
            // Start at 1 to skip header row
            for (let i = 1; i < accountsLines.length; i++) {
                const line = accountsLines[i].trim();
                if (!line) {
                    continue;
                }

                const [id, profileId, institutionId, name, category, type, subtype, balance, hidden, retirement] = line.split(',');
                accountsMap.set(name.trim(), id.trim());

                if (id && profileId && name) {
                    await client.query(
                        `INSERT INTO finance.accounts (
                            id, profile_id, institution_id, name, account_category, account_group, account_type, balance, is_hidden, is_retirement
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

        // 4. Load Categories
        const categoriesMap = new Map<string, string>();
        console.log(' 4. Reading categories.csv...');
        const categoriesLines = await readCsv('categories.csv');
        if (categoriesLines.length > 0) {
            let count = 0;
            // Start at 1 to skip header row
            for (let i = 1; i < categoriesLines.length; i++) {
                const line = categoriesLines[i].trim();
                if (!line) {
                    continue;
                }

                const [id, profileId, type, group, icon, name, isActive] = line.split(',');

                if (id && profileId && type && group && icon && name && isActive) {
                    categoriesMap.set(name.trim(), id.trim());

                    await client.query(
                        `INSERT INTO finance.categories (
                            id, profile_id, category_class, category_group, icon, name, is_active
                         ) VALUES ($1, $2, $3, $4, $5, $6, $7)
                         ON CONFLICT (id) DO NOTHING`,
                        [
                            id.trim(),
                            profileId.trim(),
                            type.trim(),
                            group.trim(),
                            icon.trim(),
                            name.trim(),
                            isActive?.trim().toLowerCase() === 'true'
                        ]
                    );
                    count++;
                }
            }
            console.log(`✅ Seeded ${count} finance.categories.`);
        }

        // 5. Load Transactions
        console.log(' 5. Reading transactions...');
        const transactionsDir = path.join(DATA_DIR, 'transactions');

        if (fs.existsSync(transactionsDir)) {
            const transactionFiles = fs.readdirSync(transactionsDir);
            let transactionCount = 0;

            for (const file of transactionFiles) {
                if (!file.endsWith('.csv')) {
                    continue;
                }

                console.log(`    Processing ${file}...`);
                const lines = await readCsv(path.join('transactions', file));

                // Start at 1 to skip header row
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) {
                        continue;
                    }

                    const [date, merchant, categoryName, accountName, originalStatement, notes, amount] = line.split(',');

                    const accountId = accountsMap.get(accountName?.trim());

                    if (accountId && date && amount) {
                        const categoryId = categoriesMap.get(categoryName?.trim()) || null;
                        transactionCount++;
                        const txnId = generateEntityId(EntityIdPrefix.FinanceTransaction);

                        await client.query(
                            `INSERT INTO finance.transactions (
                                id, account_id, category_id, date, amount, merchant, 
                                original_statement, notes, is_hidden, is_split
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                            ON CONFLICT (id) DO NOTHING`,
                            [
                                txnId,
                                accountId,
                                categoryId,
                                date.trim(),
                                parseFloat(amount.trim()),
                                merchant?.trim() || null,
                                originalStatement?.trim() || null,
                                notes?.trim() || null,
                                false,
                                false
                            ]
                        );
                    }
                }
            }
            console.log(`✅ Seeded ${transactionCount} finance.transactions.`);
        }
        else {
            console.log('   No transactions directory found, skipping.');
        }

        // 6. Load Balance History
        console.log(' 6. Reading balance history...');
        const balanceHistoryDir = path.join(DATA_DIR, 'balance_history');

        if (fs.existsSync(balanceHistoryDir)) {
            const balanceFiles = fs.readdirSync(balanceHistoryDir);
            let balanceCount = 0;

            for (const file of balanceFiles) {
                if (!file.endsWith('.csv')) {
                    continue;
                }

                console.log(`    Processing ${file}...`);
                const lines = await readCsv(path.join('balance_history', file));

                // Start at 1 to skip header row
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) {
                        continue;
                    }

                    const [date, balance, accountName] = line.split(',');
                    const accountId = accountsMap.get(accountName?.trim());

                    if (accountId && date && balance) {
                        balanceCount++;
                        const bhId = generateEntityId(EntityIdPrefix.FinanceBalanceHistory);

                        await client.query(
                            `INSERT INTO finance.balance_history (
                                id, account_id, date, balance
                            ) VALUES ($1, $2, $3, $4)
                            ON CONFLICT (id) DO NOTHING`,
                            [
                                bhId,
                                accountId,
                                date.trim(),
                                parseFloat(balance.trim())
                            ]
                        );
                    }
                }
            }
            console.log(`✅ Seeded ${balanceCount} finance.balance_history records.`);
        } else {
            console.log('   No balance_history directory found, skipping.');
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