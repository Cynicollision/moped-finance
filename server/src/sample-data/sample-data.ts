import fs from 'fs';
import path from 'path';
import { sql } from 'drizzle-orm';
import { CalendarPeriod } from '@shared/core/enum';
import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';
import { AccountType, CategoryNecessity, CategoryType } from '@shared/finance/enum';
import {
    Account,
    BalanceHistory,
    BudgetStreamFields,
    Category,
    CategoryGroup,
    Institution,
    Transaction
} from '@shared/finance/types';
import { AccountData } from '@server/api/accounts/account-data';
import { BalanceHistoryData } from '@server/api/accounts/balance-history-data';
import { BudgetStreamData } from '@server/api/budget/budget-stream-data';
import { CategoryGroupData } from '@server/api/categories/category-groups/category-group-data';
import { CategoryData } from '@server/api/categories/category-data';
import { InstitutionData } from '@server/api/institutions/institution-data';
import { TransactionCsv } from '@server/api/transactions/transaction-csv';
import { TransactionData } from '@server/api/transactions/transaction-data';
import { CsvFile, CsvRow, CsvValue, CsvValueResult } from '@server/csv';
import { DatabaseClient, EntityFactory } from '@server/data';

// Imports come from the data files rather than the domain barrels, which load the routes and auth middleware.

/** What `SampleData.load` saved. */
export interface SampleDataSummary {
    institutions: number;
    accounts: number;
    categoryGroups: number;
    categories: number;
    budgetStreams: number;
    transactions: number;
    balances: number;
    /** The newest transaction or balance date, after moving. */
    lastDate: CalendarDate;
}

interface SampleRecords {
    institutions: Institution[];
    accounts: Account[];
    groups: CategoryGroup[];
    categories: Category[];
    budgetStreams: BudgetStreamFields[];
    transactions: Transaction[];
    balances: BalanceHistory[];
}

/**
 * The synthetic sample data in `server/seed-data/` (see its README): `db:seed:finance` in development, and the
 * production image's `load-sample-data` command (APP-10.3). Records refer to each other by name, and
 * `transactions.csv` goes through the same reader as a transaction import.
 */
export class SampleData {
    constructor(
        private readonly dbClient: DatabaseClient,
        private readonly dataDir: string
    ) {}

    /** Whether the finance tables hold nothing, which `load` needs, since the sample's names would clash. */
    public async isFinanceEmpty(): Promise<boolean> {
        const result = await this.dbClient.drizzle.execute<{ has_data: boolean }>(sql`
            SELECT EXISTS (SELECT 1 FROM finance.institutions)
                OR EXISTS (SELECT 1 FROM finance.accounts)
                OR EXISTS (SELECT 1 FROM finance.category_groups)
                OR EXISTS (SELECT 1 FROM finance.categories)
                OR EXISTS (SELECT 1 FROM finance.budget_streams)
                OR EXISTS (SELECT 1 FROM finance.transactions)
                OR EXISTS (SELECT 1 FROM finance.balance_history) AS has_data
        `);
        return !result.rows[0].has_data;
    }

    /**
     * Reads every file, then saves the records into an empty finance schema. With `endingBy`, transaction and balance
     * dates move forward by whole months, as far as they can without the newest passing `endingBy`, so the data ends
     * near today rather than when it was written (APP-10.4). Nothing is saved if a file has a bad row.
     */
    public async load(options: { endingBy?: CalendarDate } = {}): Promise<SampleDataSummary> {
        const records = this.read();
        const lastDate = this.lastDate(records);
        const months = options.endingBy ? SampleData.monthsToMove(lastDate, options.endingBy) : 0;
        if (months !== 0) {
            this.moveDates(records, months);
        }

        const institutionData = new InstitutionData(this.dbClient);
        for (const institution of records.institutions) {
            await institutionData.insert(institution);
        }
        const accountData = new AccountData(this.dbClient);
        for (const account of records.accounts) {
            await accountData.insert(account);
        }
        const groupData = new CategoryGroupData(this.dbClient);
        for (const group of records.groups) {
            await groupData.insert(group);
        }
        const categoryData = new CategoryData(this.dbClient);
        for (const category of records.categories) {
            await categoryData.insert(category);
        }
        const budgetStreamData = new BudgetStreamData(this.dbClient);
        for (const stream of records.budgetStreams) {
            await budgetStreamData.insert(stream);
        }
        await new TransactionData(this.dbClient).insertBulk(records.transactions);
        await new BalanceHistoryData(this.dbClient).insertBulk(records.balances);

        return {
            institutions: records.institutions.length,
            accounts: records.accounts.length,
            categoryGroups: records.groups.length,
            categories: records.categories.length,
            budgetStreams: records.budgetStreams.length,
            transactions: records.transactions.length,
            balances: records.balances.length,
            lastDate: this.lastDate(records)
        };
    }

    /** The whole months to add to `lastDate` to bring it as close to `endingBy` as possible without passing it. */
    public static monthsToMove(lastDate: CalendarDate, endingBy: CalendarDate): number {
        const monthIndex = (date: CalendarDate) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
        const months = monthIndex(endingBy) - monthIndex(lastDate);
        return CalendarDateUtil.addMonths(lastDate, months) > endingBy ? months - 1 : months;
    }

    private read(): SampleRecords {
        const institutions: Institution[] = [];
        const accounts: Account[] = [];
        // Institutions are created from the accounts' InstitutionName, like category groups from categories.
        const institutionIds = new Map<string, string>();
        const accountIds = new Map<string, string>();
        const accountsFile = 'accounts.csv';
        const accountTypes: string[] = Object.values(AccountType);
        for (const row of this.readRows(accountsFile, ['InstitutionName', 'Name', 'Type', 'IsHidden'])) {
            if (!accountTypes.includes(row.values['Type'])) {
                throw new Error(`${accountsFile} row ${row.rowNumber}: unknown type '${row.values['Type']}'.`);
            }
            let institutionId = institutionIds.get(row.values['InstitutionName'].toLowerCase());
            if (!institutionId) {
                const institution = EntityFactory.createInstitution({ name: row.values['InstitutionName'] });
                institutions.push(institution);
                institutionId = institution.id;
                institutionIds.set(institution.name.toLowerCase(), institution.id);
            }
            const account = EntityFactory.createAccount({
                institutionId,
                name: row.values['Name'],
                type: row.values['Type'] as AccountType,
                isHidden: this.valueOf(accountsFile, row, CsvValue.boolean('IsHidden', row.values['IsHidden'])),
                isManual: true
            });
            accounts.push(account);
            accountIds.set(account.name.toLowerCase(), account.id);
        }

        const groups: CategoryGroup[] = [];
        const categories: Category[] = [];
        const groupIds = new Map<string, string>();
        const categoryIds = new Map<string, string>();
        const categoriesFile = 'categories.csv';
        for (const row of this.readRows(categoriesFile, ['Type', 'Group', 'Name', 'Icon', 'Necessity', 'IsActive'])) {
            let groupId = groupIds.get(row.values['Group'].toLowerCase());
            if (!groupId) {
                const group = EntityFactory.createCategoryGroup({
                    type: row.values['Type'].toLowerCase() as CategoryType,
                    name: row.values['Group']
                });
                groups.push(group);
                groupId = group.id;
                groupIds.set(group.name.toLowerCase(), group.id);
            }
            const category = EntityFactory.createCategory({
                groupId,
                icon: row.values['Icon'],
                name: row.values['Name'],
                isActive: this.valueOf(categoriesFile, row, CsvValue.boolean('IsActive', row.values['IsActive'])),
                necessity: (row.values['Necessity'].toLowerCase() || null) as CategoryNecessity | null
            });
            categories.push(category);
            categoryIds.set(category.name.toLowerCase(), category.id);
        }

        const streamsFile = 'budget-streams.csv';
        const budgetStreams = this.readRows(streamsFile, ['Name', 'CategoryName', 'Recurrence', 'Amount']).map(row =>
            EntityFactory.createBudgetStream({
                name: row.values['Name'],
                categoryId: this.idOf(categoryIds, row.values['CategoryName'], streamsFile, row),
                recurrence: row.values['Recurrence'] as CalendarPeriod,
                amount: this.valueOf(streamsFile, row, CsvValue.amount('Amount', row.values['Amount']))
            })
        );

        const transactionsFile = 'transactions.csv';
        const transactions = TransactionCsv.read(this.readFile(transactionsFile), { accountIds, categoryIds });
        if (!transactions.success) {
            throw new Error(`${transactionsFile}: ${transactions.message}`);
        }
        if (transactions.failedRowMessages.length > 0) {
            throw new Error(`${transactionsFile}: ${transactions.failedRowMessages.join('; ')}`);
        }
        if (transactions.unmatchedCategories.length > 0) {
            const names = transactions.unmatchedCategories.map(category => `'${category.name}'`).join(', ');
            throw new Error(`${transactionsFile}: categories not found: ${names}.`);
        }

        const balancesFile = 'balance-history.csv';
        const balances = this.readRows(balancesFile, ['Date', 'AccountName', 'Balance']).map(row =>
            EntityFactory.createBalanceHistory({
                accountId: this.idOf(accountIds, row.values['AccountName'], balancesFile, row),
                date: this.valueOf(balancesFile, row, CsvValue.date('Date', row.values['Date'])),
                balance: this.valueOf(balancesFile, row, CsvValue.amount('Balance', row.values['Balance']))
            })
        );

        return {
            institutions,
            accounts,
            groups,
            categories,
            budgetStreams,
            transactions: transactions.rows.map(row => row.transaction),
            balances
        };
    }

    /**
     * Moves transaction and balance dates by `months`. A day past the end of a shorter month becomes its last day, so
     * two balances of one account can land on the same date; the one from the later date is kept.
     */
    private moveDates(records: SampleRecords, months: number): void {
        records.transactions = records.transactions.map(transaction => ({
            ...transaction,
            date: CalendarDateUtil.addMonths(transaction.date, months)
        }));

        const balances = new Map<string, BalanceHistory>();
        const byDate = [...records.balances].sort((a, b) => a.date.localeCompare(b.date));
        for (const balance of byDate) {
            const date = CalendarDateUtil.addMonths(balance.date, months);
            balances.set(`${balance.accountId}|${date}`, { ...balance, date });
        }
        records.balances = [...balances.values()];
    }

    private lastDate(records: SampleRecords): CalendarDate {
        return [...records.transactions, ...records.balances]
            .map(record => record.date)
            .reduce((last, date) => (date > last ? date : last));
    }

    private readFile(fileName: string): Buffer {
        return fs.readFileSync(path.join(this.dataDir, fileName));
    }

    private readRows(fileName: string, headers: string[]): CsvRow[] {
        const csv = CsvFile.read(this.readFile(fileName), headers);
        if (!csv.success) {
            throw new Error(`${fileName}: ${csv.message}`);
        }
        const badRow = csv.rows.find(row => row.error);
        if (badRow) {
            throw new Error(`${fileName} row ${badRow.rowNumber}: ${badRow.error}`);
        }
        return csv.rows;
    }

    private valueOf<T>(fileName: string, row: CsvRow, result: CsvValueResult<T>): T {
        if (!result.success) {
            throw new Error(`${fileName} row ${row.rowNumber}: ${result.message}`);
        }
        return result.value;
    }

    private idOf(ids: Map<string, string>, name: string, fileName: string, row: CsvRow): string {
        const id = ids.get(name.toLowerCase());
        if (!id) {
            throw new Error(`${fileName} row ${row.rowNumber}: '${name}' not found.`);
        }
        return id;
    }
}
