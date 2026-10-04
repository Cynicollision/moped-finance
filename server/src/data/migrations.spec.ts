import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { CalendarPeriod } from '@shared/core/enum';
import { AccountCategory, AccountGroup, AccountType, CategoryType } from '@shared/finance/enum';
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

    async function runMigration(tag: string) {
        const migration = fs.readFileSync(path.join(__dirname, '../../migrations', `${tag}.sql`), 'utf-8');
        await pglite.exec(migration.split('--> statement-breakpoint').join(''));
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
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
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
});
