import fs from 'fs';
import path from 'path';
import { CalendarPeriod } from '@shared/core/enum';
import { AccountCategory, AccountGroup, AccountType, CategoryClass } from '@shared/finance/enum';
import { FinanceAccountData } from '@server/api/accounts/account-data';
import { FinanceBalanceHistoryData } from '@server/api/accounts/balance-history-data';
import { FinanceBudgetStreamData } from '@server/api/budget/budget-stream-data';
import { FinanceCategoryGroupData } from '@server/api/categories/category-groups/category-group-data';
import { FinanceCategoryData } from '@server/api/categories/category-data';
import { FinanceInstitutionData } from '@server/api/institutions/institution-data';
import { TransactionCsv } from '@server/api/transactions/transaction-csv';
import { FinanceTransactionData } from '@server/api/transactions/transaction-data';
import { CsvFile, CsvRow, CsvValue, CsvValueResult } from '@server/csv';
import { DatabaseClient, FinanceEntityFactory } from '@server/data';

// Imports come from the data files rather than the domain barrels, which load the routes and auth middleware.
// Seeds the synthetic sample data in server/seed-data/ (see its README). Records are linked by name, and
// transactions.csv goes through the same reader as a transaction import.
const DATA_DIR = path.join(__dirname, './../seed-data');

const dbClient = DatabaseClient.fromConfig({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE,
    port: parseInt(process.env.PGPORT || '5432'),
});

function readFile(fileName: string): Buffer {
    return fs.readFileSync(path.join(DATA_DIR, fileName));
}

function readRows(fileName: string, headers: string[]): CsvRow[] {
    const csv = CsvFile.read(readFile(fileName), headers);
    if (!csv.success) {
        throw new Error(`${fileName}: ${csv.message}`);
    }
    const badRow = csv.rows.find(row => row.error);
    if (badRow) {
        throw new Error(`${fileName} row ${badRow.rowNumber}: ${badRow.error}`);
    }
    return csv.rows;
}

function valueOf<T>(fileName: string, row: CsvRow, result: CsvValueResult<T>): T {
    if (!result.success) {
        throw new Error(`${fileName} row ${row.rowNumber}: ${result.message}`);
    }
    return result.value;
}

function idOf(ids: Map<string, string>, name: string, fileName: string, row: CsvRow): string {
    const id = ids.get(name.toLowerCase());
    if (!id) {
        throw new Error(`${fileName} row ${row.rowNumber}: '${name}' not found.`);
    }
    return id;
}

(async () => {
    try {
        console.log('🌱 Seeding finance data...');

        // Institutions are created from the accounts' InstitutionName, like category groups from categories.
        const institutionData = new FinanceInstitutionData(dbClient);
        const accountData = new FinanceAccountData(dbClient);
        const institutionIds = new Map<string, string>();
        const accountIds = new Map<string, string>();
        const accountsFile = 'accounts.csv';
        for (const row of readRows(accountsFile, ['InstitutionName', 'Name', 'Category', 'Group', 'Type', 'IsHidden', 'IsRetirement'])) {
            let institutionId = institutionIds.get(row.values['InstitutionName'].toLowerCase());
            if (!institutionId) {
                const institution = await institutionData.insert(FinanceEntityFactory.createInstitution({ name: row.values['InstitutionName'] }));
                institutionId = institution.id;
                institutionIds.set(institution.name.toLowerCase(), institution.id);
            }
            const account = await accountData.insert(FinanceEntityFactory.createAccount({
                institutionId,
                name: row.values['Name'],
                category: row.values['Category'] as AccountCategory,
                group: row.values['Group'] as AccountGroup,
                type: (row.values['Type'] || null) as AccountType | null,
                isHidden: valueOf(accountsFile, row, CsvValue.boolean('IsHidden', row.values['IsHidden'])),
                isManual: false,
                isRetirement: valueOf(accountsFile, row, CsvValue.boolean('IsRetirement', row.values['IsRetirement'])),
                hideFromCashflow: false,
            }));
            accountIds.set(account.name.toLowerCase(), account.id);
        }
        console.log(`✅ ${institutionIds.size} institutions, ${accountIds.size} accounts`);

        const groupData = new FinanceCategoryGroupData(dbClient);
        const categoryData = new FinanceCategoryData(dbClient);
        const groupIds = new Map<string, string>();
        const categoryIds = new Map<string, string>();
        const categoriesFile = 'categories.csv';
        for (const row of readRows(categoriesFile, ['Class', 'Group', 'Icon', 'Name', 'IsActive'])) {
            let groupId = groupIds.get(row.values['Group'].toLowerCase());
            if (!groupId) {
                const group = await groupData.insert(FinanceEntityFactory.createCategoryGroup({
                    class: row.values['Class'] as CategoryClass,
                    name: row.values['Group'],
                }));
                groupId = group.id;
                groupIds.set(group.name.toLowerCase(), group.id);
            }
            const category = await categoryData.insert(FinanceEntityFactory.createCategory({
                groupId,
                icon: row.values['Icon'],
                name: row.values['Name'],
                isActive: valueOf(categoriesFile, row, CsvValue.boolean('IsActive', row.values['IsActive'])),
            }));
            categoryIds.set(category.name.toLowerCase(), category.id);
        }
        console.log(`✅ ${groupIds.size} category groups, ${categoryIds.size} categories`);

        const budgetStreamData = new FinanceBudgetStreamData(dbClient);
        const streamsFile = 'budget-streams.csv';
        const streamRows = readRows(streamsFile, ['Name', 'CategoryName', 'Recurrence', 'Amount']);
        for (const row of streamRows) {
            await budgetStreamData.insert(FinanceEntityFactory.createBudgetStream({
                name: row.values['Name'],
                categoryId: idOf(categoryIds, row.values['CategoryName'], streamsFile, row),
                recurrence: row.values['Recurrence'] as CalendarPeriod,
                amount: valueOf(streamsFile, row, CsvValue.amount('Amount', row.values['Amount'])),
            }));
        }
        console.log(`✅ ${streamRows.length} budget streams`);

        const transactions = TransactionCsv.read(readFile('transactions.csv'), { accountIds, categoryIds });
        if (!transactions.success) {
            throw new Error(`transactions.csv: ${transactions.message}`);
        }
        if (transactions.failedRowMessages.length > 0) {
            throw new Error(`transactions.csv: ${transactions.failedRowMessages.join('; ')}`);
        }
        await new FinanceTransactionData(dbClient).insertBulk(transactions.transactions);
        console.log(`✅ ${transactions.transactions.length} transactions`);

        const balancesFile = 'balance-history.csv';
        const balances = readRows(balancesFile, ['Date', 'AccountName', 'Balance']).map(row => FinanceEntityFactory.createBalanceHistory({
            accountId: idOf(accountIds, row.values['AccountName'], balancesFile, row),
            date: valueOf(balancesFile, row, CsvValue.date('Date', row.values['Date'])),
            balance: valueOf(balancesFile, row, CsvValue.amount('Balance', row.values['Balance'])),
        }));
        await new FinanceBalanceHistoryData(dbClient).insertBulk(balances);
        console.log(`✅ ${balances.length} balance history entries`);
    }
    catch (err) {
        console.error('❌ Finance seeding failed. It expects an empty finance schema; run db:reset to start over.', err);
        process.exitCode = 1;
    }
    finally {
        await dbClient.close();
    }
})();
