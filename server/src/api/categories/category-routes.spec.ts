import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { CalendarPeriod } from '@shared/core/enum';
import { CategoryNecessity, CategoryType } from '@shared/finance/enum';
import { DatabaseClient, FinanceEntityFactory } from '@server/data';
import { IAppLogger } from '@server/logging';
import { TestExpressUtil, TestDatabaseUtil } from '@server/utility/testing';
import { FinanceBudgetStreamData } from './../budget/budget-stream-data';
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
        it('should return a list of category groups', async () => {
            const g1 = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Income, name: 'Job' }));
            const g2 = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Bills' }));

            const response = await request(app).get('/categories/groups');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map((g: any) => g.id)).toEqual(expect.arrayContaining([g1.id, g2.id]));
        });
    });

    describe('GET /categories/groups/:id', () => {
        it('should return a single category group', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Income, name: 'Job' }));

            const response = await request(app).get(`/categories/groups/${group.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(group.id);
            expect(response.body.name).toBe('Job');
        });

        it('should return 404 when group not found', async () => {
            const response = await request(app).get('/categories/groups/missing');

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });
    });

    describe('POST /categories/groups', () => {
        it('should create a new category group', async () => {
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
    });

    describe('PUT /categories/groups/:id', () => {
        it('should update a category group', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Income, name: 'Old Name' }));

            const payload = { ...group, name: 'New Name' };
            const response = await request(app).put(`/categories/groups/${group.id}`).send(payload);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('New Name');

            const updated = await groupsData.retrieveSingle(group.id!);
            expect(updated?.name).toBe('New Name');
        });

        it('CAT-1.14 should refuse to change the type of a group that has categories', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Income, name: 'Job' }));
            await categoriesData.insert(FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Paycheck', icon: 'cash', isActive: true }));

            const response = await request(app).put(`/categories/groups/${group.id}`).send({ ...group, type: CategoryType.Expense });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('A category group\'s type can\'t be changed while it has categories.');
            expect((await groupsData.retrieveSingle(group.id!))?.type).toBe(CategoryType.Income);
        });

        it('CAT-1.14 should change the type of an empty group', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Income, name: 'Job' }));

            const response = await request(app).put(`/categories/groups/${group.id}`).send({ ...group, type: CategoryType.Expense });

            expect(response.status).toBe(200);
            expect((await groupsData.retrieveSingle(group.id!))?.type).toBe(CategoryType.Expense);
        });
    });

    describe('DELETE /categories/groups/:id', () => {
        it('should delete a category group', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Income, name: 'Job' }));

            const response = await request(app).delete(`/categories/groups/${group.id}`);

            expect(response.status).toBe(204);

            const dbGroup = await groupsData.retrieveSingle(group.id!);
            expect(dbGroup).toBeNull();
        });

        it('APP-5.5 should refuse to delete a group that still has categories', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Food' }));
            await categoriesData.insert(FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Groceries', icon: 'apple', isActive: true }));

            const response = await request(app).delete(`/categories/groups/${group.id}`);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ code: 'IN_USE', message: 'Cannot delete a category group that still has categories.' });
            expect(await groupsData.retrieveSingle(group.id!)).not.toBeNull();
        });
    });

    // ---------------------------------------------------------
    // CATEGORIES
    // ---------------------------------------------------------
    describe('GET /categories', () => {
        it('should return a list of categories', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Housing' }));
            const category = await categoriesData.insert(FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Rent', icon: 'home', isActive: true }));

            const response = await request(app).get('/categories');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].id).toBe(category.id);
            expect(response.body[0].name).toBe('Rent');
        });

        it('should return 400 when activeOnly is invalid', async () => {
            const response = await request(app).get('/categories?activeOnly=invalid');
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('activeOnly:');
        });
    });

    describe('GET /categories/:id', () => {
        it('should return a single category', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Housing' }));
            const category = await categoriesData.insert(FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Rent', icon: 'home', isActive: true }));

            const response = await request(app).get(`/categories/${category.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(category.id);
        });
    });

    describe('POST /categories', () => {
        it('should create a new category', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Housing' }));

            const payload = {
                groupId: group.id,
                icon: 'home',
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

        it('CAT-5.3 should refuse to name a category Uncategorized', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Misc' }));
            const category = await categoriesData.insert(FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Other', icon: '❔', isActive: true }));
            const refusal = 'Uncategorized is reserved for transactions without a category.';

            const created = await request(app).post('/categories').send({ groupId: group.id, icon: '❔', name: ' uncategorized ', isActive: true });
            const renamed = await request(app).put(`/categories/${category.id}`).send({ name: 'Uncategorized' });

            expect([created.status, created.body.message]).toEqual([400, refusal]);
            expect([renamed.status, renamed.body.message]).toEqual([400, refusal]);
        });

        it('CAT-5.3 should let a category from before CAT-5 keep the name Uncategorized', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Misc' }));
            const category = await categoriesData.insert(FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Uncategorized', icon: '❔', isActive: true }));

            const response = await request(app).put(`/categories/${category.id}`).send({ ...category, icon: '❓' });

            expect(response.status).toBe(200);
        });

        it('APP-5.5 should reject a category whose group does not exist', async () => {
            const payload = { groupId: 'no-such-group', icon: 'home', name: 'Rent', isActive: true };

            const response = await request(app).post('/categories').send(payload);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ code: 'INVALID_REFERENCE', message: 'Category group not found.' });
        });
    });

    describe('PUT /categories/:id', () => {
        it('should update a category', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Housing' }));
            const category = await categoriesData.insert(FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Rent', icon: 'home', isActive: true }));

            const payload = { ...category, name: 'New Rent' };
            const response = await request(app).put(`/categories/${category.id}`).send(payload);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('New Rent');

            const updated = await categoriesData.retrieveSingle(category.id!);
            expect(updated?.name).toBe('New Rent');
        });
    });

    describe('necessity', () => {
        const refusal = { code: 'BAD_REQUEST', message: 'Only expense categories can have a necessity.' };

        async function groupOf(type: CategoryType, name: string) {
            return groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type, name }));
        }

        it('CAT-3.1 should save an expense category with or without a necessity', async () => {
            const food = await groupOf(CategoryType.Expense, 'Food');

            const withOne = await request(app).post('/categories').send({ groupId: food.id, icon: '🛒', name: 'Groceries', necessity: CategoryNecessity.Essential });
            const without = await request(app).post('/categories').send({ groupId: food.id, icon: '☕', name: 'Coffee' });

            expect(withOne.status).toBe(201);
            expect(withOne.body.necessity).toBe(CategoryNecessity.Essential);
            expect(without.status).toBe(201);
            expect(without.body.necessity).toBeNull();
        });

        it('CAT-3.4 should refuse a necessity on an income or transfer category', async () => {
            const work = await groupOf(CategoryType.Income, 'Work');
            const transfers = await groupOf(CategoryType.Transfer, 'Transfers');
            const pay = await categoriesData.insert(FinanceEntityFactory.createCategory({ groupId: work.id, name: 'Paycheck', icon: '💼', isActive: true }));

            const create = await request(app).post('/categories').send({ groupId: transfers.id, icon: '💳', name: 'Card', necessity: CategoryNecessity.Essential });
            const update = await request(app).put(`/categories/${pay.id}`).send({ necessity: CategoryNecessity.Discretionary });

            expect(create.status).toBe(400);
            expect(create.body).toEqual(refusal);
            expect(update.status).toBe(400);
            expect(update.body).toEqual(refusal);
            expect((await categoriesData.retrieveSingle(pay.id))?.necessity).toBeNull();
        });

        it('CAT-3.4 should refuse an unknown necessity', async () => {
            const food = await groupOf(CategoryType.Expense, 'Food');

            const response = await request(app).post('/categories').send({ groupId: food.id, icon: '🛒', name: 'Groceries', necessity: 'optional' });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('necessity');
        });

        it('CAT-1.17 should clear the necessity of a category moved out of Expense', async () => {
            const food = await groupOf(CategoryType.Expense, 'Food');
            const transfers = await groupOf(CategoryType.Transfer, 'Transfers');
            const card = await categoriesData.insert(FinanceEntityFactory.createCategory({
                groupId: food.id, name: 'Card', icon: '💳', isActive: true, necessity: CategoryNecessity.Discretionary
            }));

            // Sent back unchanged, as a client that edits the whole record does.
            const response = await request(app).put(`/categories/${card.id}`).send({ ...card, groupId: transfers.id });

            expect(response.status).toBe(200);
            expect(response.body.necessity).toBeNull();
            expect((await categoriesData.retrieveSingle(card.id))?.necessity).toBeNull();
        });

        it('CAT-3.1 should keep a necessity that an update leaves out', async () => {
            const food = await groupOf(CategoryType.Expense, 'Food');
            const rent = await categoriesData.insert(FinanceEntityFactory.createCategory({
                groupId: food.id, name: 'Rent', icon: '🏠', isActive: true, necessity: CategoryNecessity.Essential
            }));

            const response = await request(app).put(`/categories/${rent.id}`).send({ name: 'Mortgage' });

            expect(response.status).toBe(200);
            expect(response.body.necessity).toBe(CategoryNecessity.Essential);
        });
    });

    describe('DELETE /categories/:id', () => {
        it('should delete a category', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Housing' }));
            const category = await categoriesData.insert(FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Rent', icon: 'home', isActive: true }));

            const response = await request(app).delete(`/categories/${category.id}`);

            expect(response.status).toBe(204);

            const dbCategory = await categoriesData.retrieveSingle(category.id!);
            expect(dbCategory).toBeNull();
        });

        it('CAT-4.5 should refuse to delete a category used by a budget stream', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Housing' }));
            const category = await categoriesData.insert(FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Rent', icon: 'home', isActive: true }));
            await new FinanceBudgetStreamData(dbClient).insert(FinanceEntityFactory.createBudgetStream({
                categoryId: category.id!, name: 'Rent', recurrence: CalendarPeriod.Monthly, amount: 1500
            }));

            const response = await request(app).delete(`/categories/${category.id}`);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({
                code: 'IN_USE',
                message: 'This category is used in a budget stream, which must be deleted or assigned to a different category first.'
            });
            expect(await categoriesData.retrieveSingle(category.id!)).not.toBeNull();
        });
    });
});
