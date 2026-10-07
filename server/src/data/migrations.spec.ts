import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { CalendarPeriod } from '@shared/core/enum';
import { AccountType, CategoryType } from '@shared/finance/enum';
import { DatabaseClient, FinanceEntityFactory } from '@server/data';
import { TestDatabaseUtil } from '@server/utility/testing';
import { FinanceAccountData } from './../api/accounts';
import { FinanceBudgetStreamData } from './../api/budget/budget-stream-data';
import { FinanceCategoryData, FinanceCategoryGroupData } from './../api/categories';
import { FinanceInstitutionData } from './../api/institutions';
import { FinanceTransactionData } from './../api/transactions/transaction-data';

// Migrations that change data, not just the schema. Each test sets up data the way it was before the migration, then
// runs the migration's SQL again.
describe('Data migrations', () => {
    let dbClient: DatabaseClient;
    let pglite: PGlite;

    beforeAll(async () => {
        ({ dbClient, pglite } = await TestDatabaseUtil.createMockDatabase());
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    beforeEach(async () => {
        await TestDatabaseUtil.clearFinanceData(pglite);
    });

    const migrationsFolder = path.join(__dirname, '../../migrations');

    async function runMigration(tag: string, db = pglite) {
        const migration = fs.readFileSync(path.join(migrationsFolder, `${tag}.sql`), 'utf-8');
        await db.exec(migration.split('--> statement-breakpoint').join(''));
    }

    // A new database migrated up to, but not including, the given migration: for one that drops what its data needs.
    async function databaseBefore(tag: string): Promise<PGlite> {
        const journal = JSON.parse(fs.readFileSync(path.join(migrationsFolder, 'meta/_journal.json'), 'utf-8'));
        const tags: string[] = journal.entries.map((entry: { tag: string }) => entry.tag);
        const db = new PGlite();
        for (const earlier of tags.slice(0, tags.indexOf(tag))) {
            await runMigration(earlier, db);
        }
        return db;
    }

    async function categoryOf(transactionId: string): Promise<string | null> {
        const result = await pglite.query<{ category_id: string | null }>(
            'SELECT category_id FROM finance.transactions WHERE id = $1',
            [transactionId]
        );
        return result.rows[0].category_id;
    }

    describe('0007_uncategorized_state', () => {
        it("CAT-5.6 should make an Uncategorized category's transactions uncategorized and delete it", async () => {
            const groups = new FinanceCategoryGroupData(dbClient);
            const categories = new FinanceCategoryData(dbClient);
            const group = await groups.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Misc' })
            );
            const uncategorized = await categories.insert(
                FinanceEntityFactory.createCategory({
                    groupId: group.id!,
                    name: 'Uncategorized',
                    icon: '❓',
                    isActive: true
                })
            );
            const rent = await categories.insert(
                FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Rent', icon: '🏠', isActive: true })
            );
            const institution = await new FinanceInstitutionData(dbClient).insert(
                FinanceEntityFactory.createInstitution({ name: 'Bank' })
            );
            const account = await new FinanceAccountData(dbClient).insert(
                FinanceEntityFactory.createAccount({
                    institutionId: institution.id!,
                    name: 'Checking',
                    type: AccountType.Checking
                })
            );
            const transactions = new FinanceTransactionData(dbClient);
            const transaction = (categoryId: string) =>
                transactions.insert(
                    FinanceEntityFactory.createTransaction({
                        accountId: account.id!,
                        categoryId,
                        date: '2026-06-01',
                        amount: -10,
                        merchant: 'Shop',
                        originalStatement: '',
                        notes: '',
                        isHidden: false,
                        isSplit: false,
                        splitParentId: ''
                    })
                );
            const t1 = await transaction(uncategorized.id!);
            const t2 = await transaction(rent.id!);

            await runMigration('0007_uncategorized_state');

            expect(await categoryOf(t1.id!)).toBeNull();
            expect(await categoryOf(t2.id!)).toBe(rent.id);
            expect(await categories.retrieveSingle(uncategorized.id!)).toBeNull();
            expect(await categories.retrieveSingle(rent.id!)).not.toBeNull();
        });

        it('CAT-5.6 should keep an Uncategorized category that a budget stream uses', async () => {
            const group = await new FinanceCategoryGroupData(dbClient).insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Misc' })
            );
            const categories = new FinanceCategoryData(dbClient);
            const uncategorized = await categories.insert(
                FinanceEntityFactory.createCategory({
                    groupId: group.id!,
                    name: 'uncategorized',
                    icon: '❓',
                    isActive: true
                })
            );
            await new FinanceBudgetStreamData(dbClient).insert(
                FinanceEntityFactory.createBudgetStream({
                    categoryId: uncategorized.id!,
                    name: 'Buffer',
                    recurrence: CalendarPeriod.Monthly,
                    amount: 100
                })
            );

            await runMigration('0007_uncategorized_state');

            expect(await categories.retrieveSingle(uncategorized.id!)).not.toBeNull();
        });
    });
    describe('0009_account_type_only', () => {
        let before: PGlite;

        beforeEach(async () => {
            before = await databaseBefore('0009_account_type_only');
            await before.exec(`INSERT INTO finance.institutions (id, name) VALUES ('IN1', 'Bank')`);
        });

        afterEach(async () => {
            await TestDatabaseUtil.destroyMockDatabase(before);
        });

        async function addAccount(
            id: string,
            category: string,
            group: string,
            type: string | null,
            retirement = false
        ) {
            await before.query(
                `INSERT INTO finance.accounts
                    (id, institution_id, name, account_category, account_group, account_type, is_retirement)
                 VALUES ($1, 'IN1', $1, $2, $3, $4, $5)`,
                [id, category, group, type, retirement]
            );
        }

        it('ACCT-1.2 should give every account one of the new types, keeping its group', async () => {
            await addAccount('checking', 'Asset', 'Cash', 'Checking');
            await addAccount('cash-none', 'Asset', 'Cash', null);
            await addAccount('401k', 'Asset', 'Investment', '401k', true);
            await addAccount('ira', 'Asset', 'Investment', 'IRA');
            await addAccount('brokerage', 'Asset', 'Investment', 'Brokerage');
            await addAccount('retirement-brokerage', 'Asset', 'Investment', 'Brokerage', true);
            await addAccount('hsa', 'Asset', 'Investment', 'HSA');
            await addAccount('home', 'Asset', 'Real Estate', 'Primary Residence');
            await addAccount('mismatched', 'Asset', 'Real Estate', 'Checking');
            await addAccount('card', 'Liability', 'Credit Card', null);
            await addAccount('mortgage', 'Liability', 'Loan', 'Home Mortgage');
            await addAccount('loan-none', 'Liability', 'Loan', null);

            await runMigration('0009_account_type_only', before);

            const result = await before.query<{ id: string; account_type: string }>(
                'SELECT id, account_type FROM finance.accounts'
            );
            expect(Object.fromEntries(result.rows.map(row => [row.id, row.account_type]))).toEqual({
                checking: AccountType.Checking,
                'cash-none': AccountType.OtherCash,
                '401k': AccountType.Retirement401k,
                ira: AccountType.IRA,
                brokerage: AccountType.Brokerage,
                'retirement-brokerage': AccountType.OtherRetirement,
                hsa: AccountType.HSA,
                home: AccountType.PrimaryResidence,
                mismatched: AccountType.OtherProperty,
                card: AccountType.CreditCard,
                mortgage: AccountType.Mortgage,
                'loan-none': AccountType.OtherLoan
            });
        });

        it('ACCT-1.11 should make the type required and drop the category, group and retirement columns', async () => {
            await runMigration('0009_account_type_only', before);

            const columns = await before.query<{ column_name: string }>(
                `SELECT column_name FROM information_schema.columns WHERE table_schema = 'finance' AND table_name = 'accounts'`
            );
            const names = columns.rows.map(row => row.column_name);
            expect(names).toContain('account_type');
            expect(names).not.toContain('account_category');
            expect(names).not.toContain('account_group');
            expect(names).not.toContain('is_retirement');
            await expect(
                before.query(`INSERT INTO finance.accounts (id, institution_id, name) VALUES ('x', 'IN1', 'x')`)
            ).rejects.toThrow();
        });
    });
});
