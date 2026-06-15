import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import { FinanceEntityFactory, FinanceEntityIdPrefix } from './../src/finance/common';

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

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // Skip next quote
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

(async () => {
    const client = await pool.connect();
    try {
        console.log('🌱 Seeding finance data...');

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

        // 1. Load Institutions
        const institutionIdMap = new Map<string, string>();
        console.log(' 1. Reading institutions.csv...');
        const institutionLines = await readCsv('institutions.csv');

        if (institutionLines.length > 0) {
            let count = 0;
            // Start at 1 to skip header row
            for (let i = 1; i < institutionLines.length; i++) {
                const line = institutionLines[i].trim();
                if (!line) {
                    continue;
                }

                const [id, _csvUserId, name] = parseCsvLine(line);
                if (id && name) {
                    const generatedId = FinanceEntityFactory.generateId(FinanceEntityIdPrefix.Institution);
                    institutionIdMap.set(id.trim(), generatedId);

                    await client.query(
                        `INSERT INTO finance.institutions (id, user_id, name) 
                         VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
                        [generatedId, sampleUserId, name.trim()]
                    );
                    count++;
                }
            }
            console.log(`✅ Seeded ${count} finance.institutions.`);
        }

        // 2. Load Finance Accounts
        const accountsMap = new Map<string, string>();

        console.log(' 2. Reading accounts.csv...');
        const accountsLines = await readCsv('accounts.csv');
        if (accountsLines.length > 0) {
            let count = 0;
            // Start at 1 to skip header row
            for (let i = 1; i < accountsLines.length; i++) {
                const line = accountsLines[i].trim();
                if (!line) {
                    continue;
                }

                const [id, _csvUserId, institutionId, name, category, type, subtype, balance, hidden, retirement] = parseCsvLine(line);

                if (id && name) {
                    const generatedId = FinanceEntityFactory.generateId(FinanceEntityIdPrefix.Account);
                    const mappedInstitutionId = institutionIdMap.get(institutionId?.trim()) || null;
                    accountsMap.set(name.trim(), generatedId);

                    await client.query(
                        `INSERT INTO finance.accounts (
                            id, user_id, institution_id, name, account_category, account_group, account_type, is_hidden, is_manual, is_retirement, hide_from_cashflow
                         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                         ON CONFLICT (id) DO NOTHING`,
                        [
                            generatedId,
                            sampleUserId,
                            mappedInstitutionId,
                            name.trim(),
                            category.trim(),
                            type.trim(),
                            subtype?.trim() || null,
                            hidden?.trim().toLowerCase() === 'true',
                            false,
                            retirement?.trim().toLowerCase() === 'true',
                            false
                        ]
                    );
                    count++;
                }
            }
            console.log(`✅ Seeded ${count} finance.accounts.`);
        }

        // 3. Load Categories and Groups
        const categoryGroupsMap = new Map<string, string>();
        const categoriesMap = new Map<string, string>();
        console.log(' 3. Reading categories.csv...');
        const categoriesLines = await readCsv('categories.csv');
        if (categoriesLines.length > 0) {
            let catCount = 0;
            let groupCount = 0;
            // Start at 1 to skip header row
            for (let i = 1; i < categoriesLines.length; i++) {
                const line = categoriesLines[i].trim();
                if (!line) {
                    continue;
                }

                const [id, _csvUserId, type, group, icon, name, isActive] = parseCsvLine(line);

                if (id && type && group && icon && name && isActive) {
                    let groupId = categoryGroupsMap.get(group.trim());
                    if (!groupId) {
                        groupId = FinanceEntityFactory.generateId(FinanceEntityIdPrefix.CategoryGroup);
                        categoryGroupsMap.set(group.trim(), groupId);

                        await client.query(
                            `INSERT INTO finance.category_groups (
                                id, user_id, category_class, name
                             ) VALUES ($1, $2, $3, $4)
                             ON CONFLICT (id) DO NOTHING`,
                            [
                                groupId,
                                sampleUserId,
                                type.trim(),
                                group.trim()
                            ]
                        );
                        groupCount++;
                    }

                    const generatedId = FinanceEntityFactory.generateId(FinanceEntityIdPrefix.Category);
                    categoriesMap.set(name.trim(), generatedId);

                    await client.query(
                        `INSERT INTO finance.categories (
                            id, user_id, group_id, icon, name, is_active
                         ) VALUES ($1, $2, $3, $4, $5, $6)
                         ON CONFLICT (id) DO NOTHING`,
                        [
                            generatedId,
                            sampleUserId,
                            groupId!,
                            icon.trim(),
                            name.trim(),
                            isActive?.trim().toLowerCase() === 'true'
                        ]
                    );
                    catCount++;
                }
            }
            console.log(`✅ Seeded ${groupCount} finance.category_groups and ${catCount} finance.categories.`);
        }

        // 4. Load Transactions
        console.log(' 4. Reading transactions...');
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

                    const [date, merchant, categoryName, accountName, originalStatement, notes, amount] = parseCsvLine(line);

                    const accountId = accountsMap.get(accountName?.trim());

                    if (accountId && date && amount) {
                        const categoryId = categoriesMap.get(categoryName?.trim()) || null;
                        transactionCount++;
                        const txnId = FinanceEntityFactory.generateId(FinanceEntityIdPrefix.Transaction);

                        await client.query(
                            `INSERT INTO finance.transactions (
                                id, user_id, account_id, category_id, date, amount, merchant, 
                                original_statement, notes, is_hidden, is_split
                            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                            ON CONFLICT (id) DO NOTHING`,
                            [
                                txnId,
                                sampleUserId,
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

        // 5. Load Balance History
        console.log(' 5. Reading balance history...');
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

                    const [date, balance, accountName] = parseCsvLine(line);
                    const accountId = accountsMap.get(accountName?.trim());

                    if (accountId && date && balance) {
                        balanceCount++;
                        const bhId = FinanceEntityFactory.generateId(FinanceEntityIdPrefix.BalanceHistory);

                        await client.query(
                            `INSERT INTO finance.balance_history (
                                id, user_id, account_id, date, balance
                            ) VALUES ($1, $2, $3, $4, $5)
                            ON CONFLICT (id) DO NOTHING`,
                            [
                                bhId,
                                sampleUserId,
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