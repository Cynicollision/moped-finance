import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { CategoryClass } from '@shared/finance/enum';
import { DatabaseClient, FinanceEntityFactory } from '@server/data';
import { AppLogger } from '@server/logging';
import { TestExpressUtil, TestDatabaseUtil } from '@server/utility/testing';
import { FinanceCategoryData } from './category-data';
import { FinanceCategoryGroupData } from './category-groups/category-group-data';
import { createCategoryRouter } from './category-routes';

describe('Category Routes', () => {
    let app: express.Express;
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let categoriesData: FinanceCategoryData;
    let groupsData: FinanceCategoryGroupData;
    let mockLogger: jest.Mocked<AppLogger>;
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
            const g1 = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ class: CategoryClass.Income, name: 'Job' }));
            const g2 = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ class: CategoryClass.Expense, name: 'Bills' }));

            const response = await request(app).get('/categories/groups');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map((g: any) => g.id)).toEqual(expect.arrayContaining([g1.id, g2.id]));
        });
    });

    describe('GET /categories/groups/:id', () => {
        it('should return a single category group', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ class: CategoryClass.Income, name: 'Job' }));

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
                class: CategoryClass.Expense,
                name: 'Housing'
            };

            const response = await request(app).post('/categories/groups').send(payload);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Housing');
            expect(response.body.class).toBe(CategoryClass.Expense);

            const group = await groupsData.retrieveSingle(response.body.id);
            expect(group).not.toBeNull();
            expect(group?.name).toBe('Housing');
        });
    });

    describe('PUT /categories/groups/:id', () => {
        it('should update a category group', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ class: CategoryClass.Income, name: 'Old Name' }));

            const payload = { ...group, name: 'New Name' };
            const response = await request(app).put(`/categories/groups/${group.id}`).send(payload);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('New Name');

            const updated = await groupsData.retrieveSingle(group.id!);
            expect(updated?.name).toBe('New Name');
        });
    });

    describe('DELETE /categories/groups/:id', () => {
        it('should delete a category group', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ class: CategoryClass.Income, name: 'Job' }));

            const response = await request(app).delete(`/categories/groups/${group.id}`);

            expect(response.status).toBe(204);

            const dbGroup = await groupsData.retrieveSingle(group.id!);
            expect(dbGroup).toBeNull();
        });

        it('APP-5.5 should refuse to delete a group that still has categories', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ class: CategoryClass.Expense, name: 'Food' }));
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
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ class: CategoryClass.Expense, name: 'Housing' }));
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
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ class: CategoryClass.Expense, name: 'Housing' }));
            const category = await categoriesData.insert(FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Rent', icon: 'home', isActive: true }));

            const response = await request(app).get(`/categories/${category.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(category.id);
        });
    });

    describe('POST /categories', () => {
        it('should create a new category', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ class: CategoryClass.Expense, name: 'Housing' }));

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

        it('APP-5.5 should reject a category whose group does not exist', async () => {
            const payload = { groupId: 'no-such-group', icon: 'home', name: 'Rent', isActive: true };

            const response = await request(app).post('/categories').send(payload);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ code: 'INVALID_REFERENCE', message: 'Category group not found.' });
        });
    });

    describe('PUT /categories/:id', () => {
        it('should update a category', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ class: CategoryClass.Expense, name: 'Housing' }));
            const category = await categoriesData.insert(FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Rent', icon: 'home', isActive: true }));

            const payload = { ...category, name: 'New Rent' };
            const response = await request(app).put(`/categories/${category.id}`).send(payload);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('New Rent');

            const updated = await categoriesData.retrieveSingle(category.id!);
            expect(updated?.name).toBe('New Rent');
        });
    });

    describe('DELETE /categories/:id', () => {
        it('should delete a category', async () => {
            const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ class: CategoryClass.Expense, name: 'Housing' }));
            const category = await categoriesData.insert(FinanceEntityFactory.createCategory({ groupId: group.id!, name: 'Rent', icon: 'home', isActive: true }));

            const response = await request(app).delete(`/categories/${category.id}`);

            expect(response.status).toBe(204);

            const dbCategory = await categoriesData.retrieveSingle(category.id!);
            expect(dbCategory).toBeNull();
        });
    });
});
