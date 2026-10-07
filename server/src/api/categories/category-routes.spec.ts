import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { CalendarPeriod } from '@shared/core/enum';
import { AccountType, CategoryNecessity, CategoryType } from '@shared/finance/enum';
import { Category, Transaction } from '@shared/finance/types';
import { DatabaseClient, FinanceEntityFactory } from '@server/data';
import { IAppLogger } from '@server/logging';
import { TestExpressUtil, TestDatabaseUtil } from '@server/utility/testing';
import { FinanceAccountData } from './../accounts';
import { FinanceBudgetStreamData } from './../budget/budget-stream-data';
import { FinanceInstitutionData } from './../institutions';
import { FinanceTransactionData } from './../transactions/transaction-data';
import { FinanceCategoryData } from './category-data';
import { FinanceCategoryGroupData } from './category-groups/category-group-data';
import { createCategoryRouter } from './category-routes';

describe('Category Routes', () => {
    let app: express.Express;
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let categoriesData: FinanceCategoryData;
    let groupsData: FinanceCategoryGroupData;
    let mockLogger: jest.Mocked<IAppLogger>;
    let testUserId: string;

    beforeAll(async () => {
        const mockDb = await TestDatabaseUtil.createMockDatabase();
        dbClient = mockDb.dbClient;
        pglite = mockDb.pglite;

        const user = await TestDatabaseUtil.createTestUser(dbClient);
        testUserId = user.id;

        categoriesData = new FinanceCategoryData(dbClient);
        groupsData = new FinanceCategoryGroupData(dbClient);
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createCategoryRouter(mockLogger, categoriesData, groupsData);
        app = TestExpressUtil.createTestApp(router, '/categories', testUserId);
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    beforeEach(async () => {
        await TestDatabaseUtil.clearFinanceData(pglite);
    });

    // ---------------------------------------------------------
    // CATEGORY GROUPS
    // ---------------------------------------------------------
    describe('GET /categories/groups', () => {
        it('CAT-1.3 should return every category group', async () => {
            const g1 = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Income, name: 'Job' })
            );
            const g2 = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Bills' })
            );

            const response = await request(app).get('/categories/groups');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map((g: any) => g.id)).toEqual(expect.arrayContaining([g1.id, g2.id]));
        });
    });

    describe('GET /categories/groups/:id', () => {
        it('CAT-1.7 should return a single category group', async () => {
            const group = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Income, name: 'Job' })
            );

            const response = await request(app).get(`/categories/groups/${group.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(group.id);
            expect(response.body.name).toBe('Job');
        });

        it('CAT-1.7 should return 404 when group not found', async () => {
            const response = await request(app).get('/categories/groups/missing');

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });
    });

    describe('POST /categories/groups', () => {
        it('CAT-1.6 should create a new category group', async () => {
            const payload = {
                type: CategoryType.Expense,
                name: 'Housing'
            };

            const response = await request(app).post('/categories/groups').send(payload);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Housing');
            expect(response.body.type).toBe(CategoryType.Expense);

            const group = await groupsData.retrieveSingle(response.body.id);
            expect(group).not.toBeNull();
            expect(group?.name).toBe('Housing');
        });

        it('CAT-1.12 should refuse a group name that is already taken, ignoring case', async () => {
            await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Housing' })
            );

            const response = await request(app)
                .post('/categories/groups')
                .send({ type: CategoryType.Income, name: 'HOUSING' });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('A category group with that name already exists.');
        });
    });

    describe('PUT /categories/groups/:id', () => {
        it('CAT-1.7 should update a category group', async () => {
            const group = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Income, name: 'Old Name' })
            );

            const payload = { ...group, name: 'New Name' };
            const response = await request(app).put(`/categories/groups/${group.id}`).send(payload);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('New Name');

            const updated = await groupsData.retrieveSingle(group.id!);
            expect(updated?.name).toBe('New Name');
        });

        it('CAT-1.14 should refuse to change the type of a group that has categories', async () => {
            const group = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Income, name: 'Job' })
            );
            await categoriesData.insert(
                FinanceEntityFactory.createCategory({
                    groupId: group.id!,
                    name: 'Paycheck',
                    icon: '💵',
                    isActive: true
                })
            );

            const response = await request(app)
                .put(`/categories/groups/${group.id}`)
                .send({ ...group, type: CategoryType.Expense });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe("A category group's type can't be changed while it has categories.");
            expect((await groupsData.retrieveSingle(group.id!))?.type).toBe(CategoryType.Income);
        });

        it('CAT-1.14 should change the type of an empty group', async () => {
            const group = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Income, name: 'Job' })
            );

            const response = await request(app)
                .put(`/categories/groups/${group.id}`)
                .send({ ...group, type: CategoryType.Expense });

            expect(response.status).toBe(200);
            expect((await groupsData.retrieveSingle(group.id!))?.type).toBe(CategoryType.Expense);
        });
    });

    describe('DELETE /categories/groups/:id', () => {
        it('CAT-1.15 should delete an empty category group', async () => {
            const group = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Income, name: 'Job' })
            );

            const response = await request(app).delete(`/categories/groups/${group.id}`);

            expect(response.status).toBe(204);

            const dbGroup = await groupsData.retrieveSingle(group.id!);
            expect(dbGroup).toBeNull();
        });

        it('APP-5.5 should refuse to delete a group that still has categories', async () => {
            const group = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Food' })
            );
            await categoriesData.insert(
                FinanceEntityFactory.createCategory({
                    groupId: group.id!,
                    name: 'Groceries',
                    icon: '🍎',
                    isActive: true
                })
            );

            const response = await request(app).delete(`/categories/groups/${group.id}`);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                code: 'IN_USE',
                message: 'Cannot delete a category group that still has categories.'
            });
            expect(await groupsData.retrieveSingle(group.id!)).not.toBeNull();
        });
    });

    // ---------------------------------------------------------
    // CATEGORIES
    // ---------------------------------------------------------
    describe('GET /categories', () => {
        it('CAT-4.1 CAT-4.3 should return every category, or only the active ones with activeOnly', async () => {
            const group = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Housing' })
            );
            const category = await categoriesData.insert(
                FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Rent', icon: '🏠', isActive: true })
            );
            const inactive = await categoriesData.insert(
                FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Old', icon: '📦', isActive: false })
            );

            const response = await request(app).get('/categories');
            const activeOnly = await request(app).get('/categories?activeOnly=true');

            expect(response.status).toBe(200);
            expect(response.body.map((c: { id: string }) => c.id)).toEqual(
                expect.arrayContaining([category.id, inactive.id])
            );
            expect(activeOnly.body.map((c: { id: string }) => c.id)).toEqual([category.id]);
            expect(activeOnly.body[0].name).toBe('Rent');
        });

        it('APP-5.7 should return 400 when activeOnly is invalid', async () => {
            const response = await request(app).get('/categories?activeOnly=invalid');
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('activeOnly:');
        });
    });

    describe('GET /categories/:id', () => {
        it('CAT-1.9 should return a single category', async () => {
            const group = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Housing' })
            );
            const category = await categoriesData.insert(
                FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Rent', icon: '🏠', isActive: true })
            );

            const response = await request(app).get(`/categories/${category.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(category.id);
        });
    });

    describe('POST /categories', () => {
        it('CAT-1.8 should create a new category', async () => {
            const group = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Housing' })
            );

            const payload = {
                groupId: group.id,
                icon: '🏠',
                name: 'Rent',
                isActive: true
            };

            const response = await request(app).post('/categories').send(payload);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Rent');

            const category = await categoriesData.retrieveSingle(response.body.id);
            expect(category).not.toBeNull();
            expect(category?.name).toBe('Rent');
        });

        it('CAT-1.13 should refuse a category name taken in any group, ignoring case', async () => {
            const housing = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Housing' })
            );
            const other = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Other' })
            );
            await categoriesData.insert(
                FinanceEntityFactory.createCategory({ groupId: housing.id!, name: 'Rent', icon: '🏠', isActive: true })
            );

            const response = await request(app).post('/categories').send({ groupId: other.id, name: 'RENT' });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('A category with that name already exists.');
        });

        it('CAT-5.3 should refuse to name a category Uncategorized', async () => {
            const group = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Misc' })
            );
            const category = await categoriesData.insert(
                FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Other', icon: '❔', isActive: true })
            );
            const refusal = 'Uncategorized is reserved for transactions without a category.';

            const created = await request(app)
                .post('/categories')
                .send({ groupId: group.id, icon: '❔', name: ' uncategorized ', isActive: true });
            const renamed = await request(app).put(`/categories/${category.id}`).send({ name: 'Uncategorized' });

            expect([created.status, created.body.message]).toEqual([400, refusal]);
            expect([renamed.status, renamed.body.message]).toEqual([400, refusal]);
        });

        it('CAT-5.3 should let a category from before CAT-5 keep the name Uncategorized', async () => {
            const group = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Misc' })
            );
            const category = await categoriesData.insert(
                FinanceEntityFactory.createCategory({
                    groupId: group.id!,
                    name: 'Uncategorized',
                    icon: '❔',
                    isActive: true
                })
            );

            const response = await request(app)
                .put(`/categories/${category.id}`)
                .send({ ...category, icon: '❓' });

            expect(response.status).toBe(200);
        });

        it('APP-5.5 should reject a category whose group does not exist', async () => {
            const payload = { groupId: 'no-such-group', icon: '🏠', name: 'Rent', isActive: true };

            const response = await request(app).post('/categories').send(payload);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ code: 'INVALID_REFERENCE', message: 'Category group not found.' });
        });
    });

    describe('PUT /categories/:id', () => {
        it('CAT-1.9 should update a category', async () => {
            const group = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Housing' })
            );
            const category = await categoriesData.insert(
                FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Rent', icon: '🏠', isActive: true })
            );

            const payload = { ...category, name: 'New Rent' };
            const response = await request(app).put(`/categories/${category.id}`).send(payload);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('New Rent');

            const updated = await categoriesData.retrieveSingle(category.id!);
            expect(updated?.name).toBe('New Rent');
        });
    });

    describe('icon', () => {
        async function housing() {
            return groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Housing' })
            );
        }

        it('CAT-1.2 should save one emoji, or none, as the icon', async () => {
            const group = await housing();

            const chef = await request(app)
                .post('/categories')
                .send({ groupId: group.id, icon: '🧑‍🍳', name: 'Cooking' });
            const missing = await request(app).post('/categories').send({ groupId: group.id, name: 'Rent' });
            const empty = await request(app).post('/categories').send({ groupId: group.id, icon: '', name: 'Repairs' });
            const cleared = await request(app).put(`/categories/${chef.body.id}`).send({ icon: '' });

            expect([chef.status, chef.body.icon]).toEqual([201, '🧑‍🍳']);
            expect([missing.status, missing.body.icon]).toEqual([201, '']);
            expect([empty.status, empty.body.icon]).toEqual([201, '']);
            expect([cleared.status, cleared.body.icon]).toEqual([200, '']);
            expect((await categoriesData.retrieveSingle(chef.body.id))?.icon).toBe('');
        });

        it('CAT-1.2 should keep the icon when an update leaves it out', async () => {
            const group = await housing();
            const category = await categoriesData.insert(
                FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Rent', icon: '🏠', isActive: true })
            );

            const response = await request(app).put(`/categories/${category.id}`).send({ name: 'Mortgage' });

            expect([response.status, response.body.icon]).toEqual([200, '🏠']);
        });

        it.each(['home', '🍕🍔', '🛒 food'])('CAT-1.2 should refuse an icon that is not one emoji (%s)', async icon => {
            const group = await housing();

            const response = await request(app).post('/categories').send({ groupId: group.id, icon, name: 'Rent' });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('icon');
        });
    });

    describe('necessity', () => {
        const refusal = { code: 'BAD_REQUEST', message: 'Only expense categories can have a necessity.' };

        async function groupOf(type: CategoryType, name: string) {
            return groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type, name }));
        }

        it('CAT-3.1 should save an expense category with or without a necessity', async () => {
            const food = await groupOf(CategoryType.Expense, 'Food');

            const withOne = await request(app)
                .post('/categories')
                .send({ groupId: food.id, icon: '🛒', name: 'Groceries', necessity: CategoryNecessity.Essential });
            const without = await request(app)
                .post('/categories')
                .send({ groupId: food.id, icon: '☕', name: 'Coffee' });

            expect(withOne.status).toBe(201);
            expect(withOne.body.necessity).toBe(CategoryNecessity.Essential);
            expect(without.status).toBe(201);
            expect(without.body.necessity).toBeNull();
        });

        it('CAT-3.4 should refuse a necessity on an income or transfer category', async () => {
            const work = await groupOf(CategoryType.Income, 'Work');
            const transfers = await groupOf(CategoryType.Transfer, 'Transfers');
            const pay = await categoriesData.insert(
                FinanceEntityFactory.createCategory({ groupId: work.id, name: 'Paycheck', icon: '💼', isActive: true })
            );

            const create = await request(app)
                .post('/categories')
                .send({ groupId: transfers.id, icon: '💳', name: 'Card', necessity: CategoryNecessity.Essential });
            const update = await request(app)
                .put(`/categories/${pay.id}`)
                .send({ necessity: CategoryNecessity.Discretionary });

            expect(create.status).toBe(400);
            expect(create.body).toEqual(refusal);
            expect(update.status).toBe(400);
            expect(update.body).toEqual(refusal);
            expect((await categoriesData.retrieveSingle(pay.id))?.necessity).toBeNull();
        });

        it('CAT-3.4 should refuse an unknown necessity', async () => {
            const food = await groupOf(CategoryType.Expense, 'Food');

            const response = await request(app)
                .post('/categories')
                .send({ groupId: food.id, icon: '🛒', name: 'Groceries', necessity: 'optional' });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('necessity');
        });

        it('CAT-1.17 should clear the necessity of a category moved out of Expense', async () => {
            const food = await groupOf(CategoryType.Expense, 'Food');
            const transfers = await groupOf(CategoryType.Transfer, 'Transfers');
            const card = await categoriesData.insert(
                FinanceEntityFactory.createCategory({
                    groupId: food.id,
                    name: 'Card',
                    icon: '💳',
                    isActive: true,
                    necessity: CategoryNecessity.Discretionary
                })
            );

            // Sent back unchanged, as a client that edits the whole record does.
            const response = await request(app)
                .put(`/categories/${card.id}`)
                .send({ ...card, groupId: transfers.id });

            expect(response.status).toBe(200);
            expect(response.body.necessity).toBeNull();
            expect((await categoriesData.retrieveSingle(card.id))?.necessity).toBeNull();
        });

        it('CAT-3.1 should keep a necessity that an update leaves out', async () => {
            const food = await groupOf(CategoryType.Expense, 'Food');
            const rent = await categoriesData.insert(
                FinanceEntityFactory.createCategory({
                    groupId: food.id,
                    name: 'Rent',
                    icon: '🏠',
                    isActive: true,
                    necessity: CategoryNecessity.Essential
                })
            );

            const response = await request(app).put(`/categories/${rent.id}`).send({ name: 'Mortgage' });

            expect(response.status).toBe(200);
            expect(response.body.necessity).toBe(CategoryNecessity.Essential);
        });
    });

    describe('deleting a category', () => {
        let transactionsData: FinanceTransactionData;
        let budgetStreamData: FinanceBudgetStreamData;
        let accountId: string;
        let rent: Category;
        let mortgage: Category;

        beforeAll(() => {
            transactionsData = new FinanceTransactionData(dbClient);
            budgetStreamData = new FinanceBudgetStreamData(dbClient);
        });

        beforeEach(async () => {
            const institution = await new FinanceInstitutionData(dbClient).insert(
                FinanceEntityFactory.createInstitution({ name: 'Bank' })
            );
            const account = await new FinanceAccountData(dbClient).insert(
                FinanceEntityFactory.createAccount({
                    institutionId: institution.id!,
                    name: 'Checking',
                    type: AccountType.Checking,
                    isHidden: false,
                    isManual: true,
                    hideFromSpending: false,
                    balance: 0
                })
            );
            accountId = account.id!;

            const housing = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Housing' })
            );
            rent = await categoriesData.insert(
                FinanceEntityFactory.createCategory({ groupId: housing.id!, name: 'Rent', icon: '🏠', isActive: true })
            );
            mortgage = await categoriesData.insert(
                FinanceEntityFactory.createCategory({
                    groupId: housing.id!,
                    name: 'Mortgage',
                    icon: '',
                    isActive: true
                })
            );
        });

        function insertTransaction(categoryId: string, fields: Partial<Transaction> = {}) {
            return transactionsData.insert(
                FinanceEntityFactory.createTransaction({
                    accountId,
                    categoryId,
                    date: '2026-05-01',
                    amount: -1500,
                    merchant: 'Landlord',
                    isHidden: false,
                    isSplit: false,
                    originalStatement: '',
                    notes: '',
                    splitParentId: '',
                    ...fields
                })
            );
        }

        function insertBudgetStream(categoryId: string) {
            return budgetStreamData.insert(
                FinanceEntityFactory.createBudgetStream({
                    categoryId,
                    name: 'Rent',
                    recurrence: CalendarPeriod.Monthly,
                    amount: 1500
                })
            );
        }

        describe('GET /categories/:id/usage', () => {
            it('CAT-4.4 should count the transactions and budget streams that use a category', async () => {
                await insertTransaction(rent.id);
                await insertTransaction(rent.id, { isHidden: true });
                await insertTransaction(mortgage.id);
                await insertBudgetStream(rent.id);

                const response = await request(app).get(`/categories/${rent.id}/usage`);

                expect(response.status).toBe(200);
                expect(response.body).toEqual({ transactionCount: 2, budgetStreamCount: 1 });
            });

            it('CAT-4.4 should return 404 when the category does not exist', async () => {
                const response = await request(app).get('/categories/missing/usage');

                expect(response.status).toBe(404);
            });
        });

        describe('DELETE /categories/:id', () => {
            it('CAT-5.2 should leave the transactions of a deleted category Uncategorized', async () => {
                const transaction = await insertTransaction(rent.id);

                const response = await request(app).delete(`/categories/${rent.id}`);

                expect(response.status).toBe(204);
                expect(await categoriesData.retrieveSingle(rent.id)).toBeNull();
                expect((await transactionsData.retrieveSingle(transaction.id))?.categoryId).toBe('');
            });

            it('CAT-4.4 should move the transactions to the chosen category and delete it', async () => {
                const first = await insertTransaction(rent.id);
                const hidden = await insertTransaction(rent.id, { isHidden: true });
                const other = await insertTransaction('');

                const response = await request(app).delete(`/categories/${rent.id}?moveTo=${mortgage.id}`);

                expect(response.status).toBe(204);
                expect(await categoriesData.retrieveSingle(rent.id)).toBeNull();
                expect((await transactionsData.retrieveSingle(first.id))?.categoryId).toBe(mortgage.id);
                expect((await transactionsData.retrieveSingle(hidden.id))?.categoryId).toBe(mortgage.id);
                expect((await transactionsData.retrieveSingle(other.id))?.categoryId).toBe('');
            });

            it('CAT-4.4 should refuse a target that does not exist, and change nothing', async () => {
                const transaction = await insertTransaction(rent.id);

                const response = await request(app).delete(`/categories/${rent.id}?moveTo=missing`);

                expect(response.status).toBe(400);
                expect(response.body.message).toBe('Category not found.');
                expect(await categoriesData.retrieveSingle(rent.id)).not.toBeNull();
                expect((await transactionsData.retrieveSingle(transaction.id))?.categoryId).toBe(rent.id);
            });

            it('CAT-4.4 should refuse to move the transactions to the category being deleted', async () => {
                const transaction = await insertTransaction(rent.id);

                const response = await request(app).delete(`/categories/${rent.id}?moveTo=${rent.id}`);

                expect(response.status).toBe(400);
                expect(response.body.message).toBe(
                    "A category's transactions can't be moved to the category being deleted."
                );
                expect(await categoriesData.retrieveSingle(rent.id)).not.toBeNull();
                expect((await transactionsData.retrieveSingle(transaction.id))?.categoryId).toBe(rent.id);
            });

            it('CAT-4.4 should return 404 when the category does not exist', async () => {
                const response = await request(app).delete(`/categories/missing?moveTo=${mortgage.id}`);

                expect(response.status).toBe(404);
            });

            it('CAT-4.5 should refuse to delete a category used by a budget stream, and move nothing', async () => {
                const transaction = await insertTransaction(rent.id);
                await insertBudgetStream(rent.id);

                const response = await request(app).delete(`/categories/${rent.id}?moveTo=${mortgage.id}`);

                expect(response.status).toBe(400);
                expect(response.body).toEqual({
                    code: 'IN_USE',
                    message:
                        'This category is used in a budget stream, which must be deleted or assigned to a different category first.'
                });
                expect(await categoriesData.retrieveSingle(rent.id)).not.toBeNull();
                expect((await transactionsData.retrieveSingle(transaction.id))?.categoryId).toBe(rent.id);
            });
        });
    });

    // ---------------------------------------------------------
    // CSV EXPORT AND IMPORT
    // ---------------------------------------------------------
    describe('CSV', () => {
        const header = 'Type,Group,Name,Icon,Necessity,IsActive\n';

        async function addGroup(type: CategoryType, name: string) {
            return groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type, name }));
        }

        async function addCategory(groupId: string, name: string, fields: Partial<Category> = {}) {
            return categoriesData.insert(
                FinanceEntityFactory.createCategory({ groupId, name, icon: '', isActive: true, ...fields })
            );
        }

        function importCsv(rows: string, query = '') {
            return request(app)
                .post(`/categories/import${query}`)
                .attach('file', Buffer.from(header + rows), 'categories.csv');
        }

        async function savedCategories() {
            const groups = new Map((await groupsData.retrieveAll()).map(g => [g.id, g]));
            return (await categoriesData.retrieveAll())
                .map(c => ({
                    type: groups.get(c.groupId)!.type,
                    group: groups.get(c.groupId)!.name,
                    name: c.name,
                    icon: c.icon,
                    necessity: c.necessity,
                    isActive: c.isActive
                }))
                .sort((a, b) => a.name.localeCompare(b.name));
        }

        describe('GET /categories/export', () => {
            it('CAT-7.1 should write one row per category, ordered by type, group and name', async () => {
                const food = await addGroup(CategoryType.Expense, 'food');
                const bills = await addGroup(CategoryType.Expense, 'Bills');
                const income = await addGroup(CategoryType.Income, 'Income');
                const transfers = await addGroup(CategoryType.Transfer, 'Transfers');
                await addGroup(CategoryType.Expense, 'Empty');
                await addCategory(transfers.id, 'Card Payment', { icon: '💳' });
                await addCategory(food.id, 'groceries', { necessity: CategoryNecessity.Essential });
                await addCategory(food.id, 'Coffee', { icon: '☕', necessity: CategoryNecessity.Discretionary });
                await addCategory(bills.id, 'Internet', { isActive: false });
                await addCategory(income.id, 'Paycheck', { icon: '💼' });

                const response = await request(app).get('/categories/export');

                expect(response.status).toBe(200);
                expect(response.header['content-type']).toContain('text/csv');
                expect(response.header['content-disposition']).toMatch(
                    /attachment; filename="Categories_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv"/
                );
                expect(response.text).toBe(
                    header +
                        'Income,Income,Paycheck,💼,,true\n' +
                        'Expense,Bills,Internet,,,false\n' +
                        'Expense,food,Coffee,☕,Discretionary,true\n' +
                        'Expense,food,groceries,,Essential,true\n' +
                        'Transfer,Transfers,Card Payment,💳,,true\n'
                );
            });

            it('CAT-7.1 should write only the header when there are no categories', async () => {
                await addGroup(CategoryType.Expense, 'Empty');

                const response = await request(app).get('/categories/export');

                expect(response.text).toBe(header);
            });

            it('CAT-7.1 should re-import its own export unchanged', async () => {
                const food = await addGroup(CategoryType.Expense, 'Food, "Drink"');
                await addCategory(food.id, 'Cooking', { icon: '🧑‍🍳', necessity: CategoryNecessity.Essential });
                await addCategory(food.id, 'Old', { isActive: false });
                const before = await savedCategories();
                const exported = await request(app).get('/categories/export');
                await TestDatabaseUtil.clearFinanceData(pglite);

                const response = await request(app)
                    .post('/categories/import')
                    .attach('file', Buffer.from(exported.text), 'export.csv');

                expect(response.status).toBe(201);
                expect(await savedCategories()).toEqual(before);
            });
        });

        describe('POST /categories/import', () => {
            it('CAT-7.2 CAT-7.4 should create the categories and the groups they need, matching groups ignoring case', async () => {
                await addGroup(CategoryType.Expense, 'Food');

                const response = await importCsv(
                    'expense,food,Groceries,🛒,essential,\n' +
                        'Expense,Pets,Vet,,Essential,TRUE\n' +
                        'EXPENSE,pets,Toys,,,false\n' +
                        'Income,Side Income,Freelance,,,\n'
                );

                expect(response.status).toBe(201);
                expect(response.body).toEqual({
                    createdCount: 4,
                    newGroups: [
                        { name: 'Pets', type: CategoryType.Expense },
                        { name: 'Side Income', type: CategoryType.Income }
                    ],
                    skippedNames: [],
                    failedRowMessages: [],
                    isValidToImport: true,
                    resultMessage: 'Imported 4 categories.'
                });
                expect(await savedCategories()).toEqual([
                    {
                        type: CategoryType.Income,
                        group: 'Side Income',
                        name: 'Freelance',
                        icon: '',
                        necessity: null,
                        isActive: true
                    },
                    {
                        type: CategoryType.Expense,
                        group: 'Food',
                        name: 'Groceries',
                        icon: '🛒',
                        necessity: CategoryNecessity.Essential,
                        isActive: true
                    },
                    {
                        type: CategoryType.Expense,
                        group: 'Pets',
                        name: 'Toys',
                        icon: '',
                        necessity: null,
                        isActive: false
                    },
                    {
                        type: CategoryType.Expense,
                        group: 'Pets',
                        name: 'Vet',
                        icon: '',
                        necessity: CategoryNecessity.Essential,
                        isActive: true
                    }
                ]);
            });

            it('CAT-7.2 should report what a dry run would do, and save nothing', async () => {
                const response = await importCsv('Expense,Pets,Vet,,,\n', '?dryRun=true');

                expect(response.status).toBe(200);
                expect(response.body).toEqual(
                    expect.objectContaining({
                        createdCount: 1,
                        newGroups: [{ name: 'Pets', type: CategoryType.Expense }],
                        isValidToImport: true
                    })
                );
                expect(await groupsData.retrieveAll()).toEqual([]);
                expect(await categoriesData.retrieveAll()).toEqual([]);
            });

            it('CAT-7.3 should skip a category that already exists, ignoring case, and leave it unchanged', async () => {
                const food = await addGroup(CategoryType.Expense, 'Food');
                await addCategory(food.id, 'Coffee', { necessity: CategoryNecessity.Discretionary });

                const response = await importCsv('Expense,Drinks,coffee,☕,Essential,false\nExpense,Food,Tea,,,\n');

                expect(response.status).toBe(201);
                expect(response.body).toEqual(
                    expect.objectContaining({ createdCount: 1, newGroups: [], skippedNames: ['coffee'] })
                );
                expect(await savedCategories()).toEqual([
                    {
                        type: CategoryType.Expense,
                        group: 'Food',
                        name: 'Coffee',
                        icon: '',
                        necessity: CategoryNecessity.Discretionary,
                        isActive: true
                    },
                    expect.objectContaining({ group: 'Food', name: 'Tea' })
                ]);
            });

            it('CAT-7.4 should not create a group whose rows are all skipped', async () => {
                const food = await addGroup(CategoryType.Expense, 'Food');
                await addCategory(food.id, 'Coffee');

                const response = await importCsv('Expense,Drinks,Coffee,,,\n');

                expect(response.status).toBe(201);
                expect(response.body.newGroups).toEqual([]);
                expect((await groupsData.retrieveAll()).map(g => g.name)).toEqual(['Food']);
            });

            it('CAT-7.4 should refuse a row whose group exists with another type', async () => {
                await addGroup(CategoryType.Expense, 'Food');

                const response = await importCsv('Expense,Pets,Vet,,,\nIncome,food,Refunds,,,\n', '?dryRun=true');

                expect(response.body.isValidToImport).toBe(false);
                expect(response.body.failedRowMessages).toEqual([
                    "Row 3: Group 'Food' is an Expense group, not Income."
                ]);
            });

            it('CAT-7.4 should refuse a row that gives a new group a different type from an earlier row', async () => {
                const response = await importCsv(
                    'Expense,Pets,Vet,,,\nTransfer,Savings,Move,,,\nIncome,pets,Pet Sitting,,,\nExpense,Savings,Fees,,,\n',
                    '?dryRun=true'
                );

                expect(response.body.failedRowMessages).toEqual([
                    "Row 4: Group 'Pets' is an Expense group in row 2, not Income.",
                    "Row 5: Group 'Savings' is a Transfer group in row 3, not Expense."
                ]);
            });

            it('CAT-7.5 should report every problem in a row as one message', async () => {
                const response = await importCsv(
                    'Spending,,,home,Vital,maybe\n' +
                        `Income,${'G'.repeat(101)},Salary,🏠🏠,Essential,\n` +
                        'Transfer,Moves,Uncategorized,,,\n' +
                        'Expense,Food,Coffee,,,\n' +
                        'Expense,Drinks,COFFEE,,,\n' +
                        'Expense,Food\n',
                    '?dryRun=true'
                );

                expect(response.status).toBe(200);
                expect(response.body).toEqual(
                    expect.objectContaining({
                        isValidToImport: false,
                        createdCount: 0,
                        newGroups: [],
                        resultMessage: 'Found errors in 5 of 6 rows.',
                        failedRowMessages: [
                            "Row 2: Type 'Spending' must be Income, Expense or Transfer. Group is required. Name is required. Icon 'home' is not a single emoji. Necessity 'Vital' must be Essential, Discretionary or blank. IsActive must be true, false or blank.",
                            "Row 3: Group is longer than 100 characters. Icon '🏠🏠' is not a single emoji. Necessity must be blank for an Income category.",
                            'Row 4: Uncategorized is reserved for transactions without a category.',
                            "Row 6: Name 'COFFEE' is already in row 5.",
                            'Row 7: Expected 6 columns. Name is required.'
                        ]
                    })
                );
            });

            it('CAT-7.5 should require a type', async () => {
                const response = await importCsv(',Food,Coffee,,,\n', '?dryRun=true');

                expect(response.body.failedRowMessages).toEqual(['Row 2: Type is required.']);
            });

            it('CAT-7.2 should save nothing and return 400 when a confirmed import has a bad row', async () => {
                const response = await importCsv('Expense,Pets,Vet,,,\nExpense,Pets,,,,\n');

                expect(response.status).toBe(400);
                expect(response.body.code).toBe('INVALID_IMPORT');
                expect(response.body.message).toBe('Nothing was imported. Found errors in 1 of 2 rows.');
                expect(response.body.details.failedRowMessages).toEqual(['Row 3: Name is required.']);
                expect(await groupsData.retrieveAll()).toEqual([]);
                expect(await categoriesData.retrieveAll()).toEqual([]);
            });

            it('CAT-7.2 should save none of the groups or categories when the database rejects one', async () => {
                // A trigger stands in for any database failure partway through the insert.
                await pglite.exec(`
                    CREATE FUNCTION finance.reject_boom() RETURNS trigger AS $$
                    BEGIN
                        IF NEW.name = 'Boom' THEN RAISE EXCEPTION 'boom'; END IF;
                        RETURN NEW;
                    END $$ LANGUAGE plpgsql;
                    CREATE TRIGGER reject_boom BEFORE INSERT ON finance.categories FOR EACH ROW EXECUTE FUNCTION finance.reject_boom();
                `);

                try {
                    const response = await importCsv('Expense,Pets,Vet,,,\nExpense,Pets,Boom,,,\n');

                    expect(response.status).toBe(500);
                    expect(await groupsData.retrieveAll()).toEqual([]);
                    expect(await categoriesData.retrieveAll()).toEqual([]);
                } finally {
                    await pglite.exec(
                        'DROP TRIGGER reject_boom ON finance.categories; DROP FUNCTION finance.reject_boom();'
                    );
                }
            });

            it('CAT-7.2 should refuse a file missing a column', async () => {
                const response = await request(app)
                    .post('/categories/import?dryRun=true')
                    .attach('file', Buffer.from('Type,Group,Name\nExpense,Food,Coffee\n'), 'categories.csv');

                expect(response.status).toBe(400);
                expect(response.body.message).toBe('Missing required CSV headers: Icon, Necessity, IsActive');
            });
        });
    });
});
