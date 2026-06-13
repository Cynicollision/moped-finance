import express from 'express';
import request from 'supertest';
import { CategoryClass } from '@shared/finance/enum';
import { Category } from '@shared/finance/types';
import { AppLogger } from '@server-core/logger';
import { DateTimeUtil } from '@server-core/utility';
import { TestExpressUtil } from '@server-core/utility/testing';
import { FinanceMockUtil } from './../finance-mocks';
import { IFinanceCategoriesData } from './category-data';
import { createCategoryRouter } from './category-routes';

describe('Category Routes', () => {
    let app: express.Express;
    let mockCategoriesData: jest.Mocked<IFinanceCategoriesData>;
    let mockLogger: jest.Mocked<AppLogger>;

    const testUserId = 'test-user-id';

    const createMockCategory = (overrides?: Partial<Category>): Category => {
        return {
            id: 'cat1',
            userId: testUserId,
            class: CategoryClass.Expense,
            group: 'Housing',
            icon: 'home',
            name: 'Rent',
            isActive: true,
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now(),
            ...overrides
        } as Category;
    };

    beforeEach(() => {
        mockCategoriesData = FinanceMockUtil.createMockCategoriesData();
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createCategoryRouter(mockLogger, mockCategoriesData);
        app = TestExpressUtil.createTestApp(router, '/categories', testUserId);
    });

    describe('GET /categories', () => {
        it('should return a list of categories when successful', async () => {
            const mockCategories = [
                createMockCategory({ id: 'cat1', name: 'Rent' }),
                createMockCategory({ id: 'cat2', name: 'Groceries' })
            ];
            mockCategoriesData.retrieveAll.mockResolvedValue(mockCategories);

            const response = await request(app).get('/categories');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(mockCategories)));
            expect(mockCategoriesData.retrieveAll).toHaveBeenCalledWith(testUserId, false);
        });
    });

    describe('GET /categories/:id', () => {
        it('should return a single category when found', async () => {
            const mockCategory = createMockCategory({ id: 'cat1', name: 'Rent' });
            mockCategoriesData.retrieveSingle.mockResolvedValue(mockCategory);

            const response = await request(app).get('/categories/cat1');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(mockCategory)));
            expect(mockCategoriesData.retrieveSingle).toHaveBeenCalledWith(testUserId, 'cat1');
        });

        it('should return 400 when category is not found', async () => {
            mockCategoriesData.retrieveSingle.mockResolvedValue(null);

            const response = await request(app).get('/categories/missing');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found');
        });
    });

    describe('POST /categories', () => {
        it('should create a new category', async () => {
            const payload = {
                class: CategoryClass.Expense,
                group: 'Housing',
                icon: 'home',
                name: 'Rent',
                isActive: true
            };
            const createdCategory = createMockCategory({ ...payload, id: 'new-cat-id' });
            mockCategoriesData.insert.mockResolvedValue(createdCategory);

            const response = await request(app)
                .post('/categories')
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(createdCategory)));
            expect(mockCategoriesData.insert).toHaveBeenCalledWith(testUserId, expect.objectContaining(payload));
        });

        it('should return 400 when schema validation fails (missing name)', async () => {
            const payload = {
                class: CategoryClass.Expense,
                group: 'Housing',
                icon: 'home'
            };

            const response = await request(app)
                .post('/categories')
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('name:');
            expect(response.body.error.message).toContain('expected string');
            expect(mockCategoriesData.insert).not.toHaveBeenCalled();
        });
    });

    describe('PUT /categories/:id', () => {
        it('should update a category when input is valid and resource belongs to user', async () => {
            const categoryId = 'cat1';
            const payload = {
                class: CategoryClass.Expense,
                group: 'Housing',
                icon: 'home',
                name: 'Updated Rent',
                isActive: true
            };
            const updatedCategory = createMockCategory({ ...payload, id: categoryId });
            mockCategoriesData.update.mockResolvedValue(updatedCategory);

            const response = await request(app)
                .put(`/categories/${categoryId}`)
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(updatedCategory)));
            expect(mockCategoriesData.update).toHaveBeenCalledWith(
                testUserId,
                expect.objectContaining({ ...payload, id: categoryId })
            );
        });

        it('should return 400 when update fails because resource does not exist or user lacks ownership', async () => {
            const categoryId = 'unowned-cat';
            const payload = {
                class: CategoryClass.Expense,
                group: 'Housing',
                icon: 'home',
                name: 'Updated Rent',
                isActive: true
            };
            mockCategoriesData.update.mockResolvedValue(null as any);

            const response = await request(app)
                .put(`/categories/${categoryId}`)
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found or access denied');
        });
    });

    describe('DELETE /categories/:id', () => {
        it('should delete a category when resource belongs to user', async () => {
            const categoryId = 'cat1';
            mockCategoriesData.delete.mockResolvedValue(true);

            const response = await request(app).delete(`/categories/${categoryId}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(mockCategoriesData.delete).toHaveBeenCalledWith(testUserId, categoryId);
        });

        it('should return 400 when delete fails because resource does not exist or user lacks ownership', async () => {
            const categoryId = 'unowned-cat';
            mockCategoriesData.delete.mockResolvedValue(false);

            const response = await request(app).delete(`/categories/${categoryId}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found or access denied');
        });
    });
});
