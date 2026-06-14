import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { CategoryClass } from '@shared/finance/enum';
import { AppLogger } from '@server-core/logger';
import { DatabaseClient } from '@server-core/db-client';
import { TestExpressUtil, TestDatabaseUtil } from '@server-core/utility/testing';
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
        if (pglite) {
            await pglite.close();
        }
    });

    beforeEach(async () => {
        await pglite.exec('TRUNCATE finance.categories, finance.category_groups CASCADE;');
    });

    // ---------------------------------------------------------
    // CATEGORY GROUPS
    // ---------------------------------------------------------
    describe('GET /categories/groups', () => {
        it('should return a list of category groups', async () => {
            await groupsData.insert(testUserId, { id: 'g1', class: CategoryClass.Income, name: 'Job' } as any);
            await groupsData.insert(testUserId, { id: 'g2', class: CategoryClass.Expense, name: 'Bills' } as any);

            const response = await request(app).get('/categories/groups');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(2);
            expect(response.body.data.map((g: any) => g.id)).toEqual(expect.arrayContaining(['g1', 'g2']));
        });
    });

    describe('GET /categories/groups/:id', () => {
        it('should return a single category group', async () => {
            await groupsData.insert(testUserId, { id: 'g1', class: CategoryClass.Income, name: 'Job' } as any);

            const response = await request(app).get('/categories/groups/g1');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe('g1');
            expect(response.body.data.name).toBe('Job');
        });

        it('should return 400 when group not found', async () => {
            const response = await request(app).get('/categories/groups/missing');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found');
        });
    });

    describe('POST /categories/groups', () => {
        it('should create a new category group', async () => {
            const payload = {
                class: CategoryClass.Expense,
                name: 'Housing'
            };

            const response = await request(app).post('/categories/groups').send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('Housing');
            expect(response.body.data.class).toBe(CategoryClass.Expense);

            const group = await groupsData.retrieveSingle(testUserId, response.body.data.id);
            expect(group).not.toBeNull();
            expect(group?.name).toBe('Housing');
        });
    });

    describe('PUT /categories/groups/:id', () => {
        it('should update a category group', async () => {
            const group = await groupsData.insert(testUserId, { id: 'g1', class: CategoryClass.Income, name: 'Old Name' } as any);

            const payload = { ...group, name: 'New Name' };
            const response = await request(app).put('/categories/groups/g1').send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('New Name');

            const updated = await groupsData.retrieveSingle(testUserId, 'g1');
            expect(updated?.name).toBe('New Name');
        });
    });

    describe('DELETE /categories/groups/:id', () => {
        it('should delete a category group', async () => {
            await groupsData.insert(testUserId, { id: 'g1', class: CategoryClass.Income, name: 'Job' } as any);

            const response = await request(app).delete('/categories/groups/g1');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const dbGroup = await groupsData.retrieveSingle(testUserId, 'g1');
            expect(dbGroup).toBeNull();
        });
    });

    // ---------------------------------------------------------
    // CATEGORIES
    // ---------------------------------------------------------
    describe('GET /categories', () => {
        it('should return a list of categories', async () => {
            const group = await groupsData.insert(testUserId, { id: 'g1', class: CategoryClass.Expense, name: 'Housing' } as any);
            await categoriesData.insert(testUserId, { id: 'c1', groupId: group.id, name: 'Rent', icon: 'home', isActive: true } as any);

            const response = await request(app).get('/categories');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(1);
            expect(response.body.data[0].id).toBe('c1');
            expect(response.body.data[0].name).toBe('Rent');
        });
    });

    describe('GET /categories/:id', () => {
        it('should return a single category', async () => {
            const group = await groupsData.insert(testUserId, { id: 'g1', class: CategoryClass.Expense, name: 'Housing' } as any);
            await categoriesData.insert(testUserId, { id: 'c1', groupId: group.id, name: 'Rent', icon: 'home', isActive: true } as any);

            const response = await request(app).get('/categories/c1');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe('c1');
        });
    });

    describe('POST /categories', () => {
        it('should create a new category', async () => {
            const group = await groupsData.insert(testUserId, { id: 'g1', class: CategoryClass.Expense, name: 'Housing' } as any);

            const payload = {
                groupId: group.id,
                icon: 'home',
                name: 'Rent',
                isActive: true
            };

            const response = await request(app).post('/categories').send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('Rent');

            const category = await categoriesData.retrieveSingle(testUserId, response.body.data.id);
            expect(category).not.toBeNull();
            expect(category?.name).toBe('Rent');
        });
    });

    describe('PUT /categories/:id', () => {
        it('should update a category', async () => {
            const group = await groupsData.insert(testUserId, { id: 'g1', class: CategoryClass.Expense, name: 'Housing' } as any);
            const category = await categoriesData.insert(testUserId, { id: 'c1', groupId: group.id, name: 'Rent', icon: 'home', isActive: true } as any);

            const payload = { ...category, name: 'New Rent' };
            const response = await request(app).put('/categories/c1').send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('New Rent');

            const updated = await categoriesData.retrieveSingle(testUserId, 'c1');
            expect(updated?.name).toBe('New Rent');
        });
    });

    describe('DELETE /categories/:id', () => {
        it('should delete a category', async () => {
            const group = await groupsData.insert(testUserId, { id: 'g1', class: CategoryClass.Expense, name: 'Housing' } as any);
            await categoriesData.insert(testUserId, { id: 'c1', groupId: group.id, name: 'Rent', icon: 'home', isActive: true } as any);

            const response = await request(app).delete('/categories/c1');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const dbCategory = await categoriesData.retrieveSingle(testUserId, 'c1');
            expect(dbCategory).toBeNull();
        });
    });
});
