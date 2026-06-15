import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { CalendarPeriod } from '@shared/core/enum/calendar-period';
import { CategoryClass } from '@shared/finance/enum';
import { BudgetStreamType } from '@shared/finance/enum/budget-stream-type';
import { AppLogger } from '@server-core/logger';
import { DatabaseClient } from '@server-core/db-client';
import { TestExpressUtil, TestDatabaseUtil } from '@server-core/utility/testing';
import { FinanceEntityFactory } from './../common';
import { FinanceBudgetStreamData } from './budget-stream-data';
import { createBudgetStreamRouter } from './budget-stream-routes';
import { FinanceCategoryGroupData } from './../categories/category-groups/category-group-data';
import { FinanceCategoryData } from './../categories/category-data';

describe('Budget Stream Routes', () => {
    let app: express.Express;
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let budgetStreamData: FinanceBudgetStreamData;
    let categoriesData: FinanceCategoryData;
    let groupsData: FinanceCategoryGroupData;
    let mockLogger: jest.Mocked<AppLogger>;
    let testUserId: string;
    let testCategoryId: string;

    beforeAll(async () => {
        const mockDb = await TestDatabaseUtil.createMockDatabase();
        dbClient = mockDb.dbClient;
        pglite = mockDb.pglite;

        const user = await TestDatabaseUtil.createTestUser(dbClient);
        testUserId = user.id;

        budgetStreamData = new FinanceBudgetStreamData(dbClient);
        categoriesData = new FinanceCategoryData(dbClient);
        groupsData = new FinanceCategoryGroupData(dbClient);
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createBudgetStreamRouter(mockLogger, budgetStreamData);
        app = TestExpressUtil.createTestApp(router, '/budget-streams', testUserId);
    });

    afterAll(async () => {
        if (pglite) {
            await pglite.close();
        }
    });

    beforeEach(async () => {
        await pglite.exec('TRUNCATE finance.category_groups, finance.categories, finance.budget_streams CASCADE;');

        const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup(testUserId, { class: CategoryClass.Expense, name: 'General' }));
        const category = await categoriesData.insert(FinanceEntityFactory.createCategory(testUserId, { groupId: group.id, name: 'Misc', icon: 'star', isActive: true }));
        testCategoryId = category.id!;
    });

    describe('GET /', () => {
        it('should return a list of budget streams when successful', async () => {
            const stream1 = await budgetStreamData.insert(FinanceEntityFactory.createBudgetStream(testUserId, { categoryId: testCategoryId,
                name: 'Utilities',
                type: BudgetStreamType.Expense,
                recurrence: CalendarPeriod.Monthly,
                amount: 150.00
            }));
            const stream2 = await budgetStreamData.insert(FinanceEntityFactory.createBudgetStream(testUserId, { categoryId: testCategoryId,
                name: 'Salary',
                type: BudgetStreamType.Income,
                recurrence: CalendarPeriod.Monthly,
                amount: 5000.00
            }));

            const response = await request(app).get('/budget-streams');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(2);
            expect(response.body.data.map((s: any) => s.id)).toEqual(expect.arrayContaining([stream1.id, stream2.id]));
        });
    });

    describe('POST /', () => {
        it('should create a new budget stream when input is valid', async () => {
            const payload = {
                name: 'Groceries',
                categoryId: testCategoryId,
                type: BudgetStreamType.Expense,
                recurrence: CalendarPeriod.Monthly,
                amount: 300.00
            };

            const response = await request(app)
                .post('/budget-streams')
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('Groceries');

            const dbStream = await budgetStreamData.retrieveSingle(response.body.data.id);
            expect(dbStream).not.toBeNull();
            expect(dbStream?.name).toBe('Groceries');
        });

        it('should return 400 when schema validation fails (missing name)', async () => {
            const payload = {
                categoryId: testCategoryId,
                type: BudgetStreamType.Expense,
                recurrence: CalendarPeriod.Monthly,
                amount: 300.00
            };

            const response = await request(app)
                .post('/budget-streams')
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('name:');
        });
    });

    describe('PUT /:id', () => {
        it('should update a budget stream when valid and resource belongs to the user', async () => {
            const stream = await budgetStreamData.insert(FinanceEntityFactory.createBudgetStream(testUserId, { categoryId: testCategoryId,
                name: 'Utilities',
                type: BudgetStreamType.Expense,
                recurrence: CalendarPeriod.Monthly,
                amount: 150.00
            }));

            const payload = { ...stream, amount: 180.00 };

            const response = await request(app)
                .put(`/budget-streams/${stream.id}`)
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.amount).toBe(180.00);

            const dbStream = await budgetStreamData.retrieveSingle(stream.id!);
            expect(dbStream?.amount).toBe(180.00);
        });
    });

    describe('DELETE /:id', () => {
        it('should delete a budget stream when resource belongs to the user', async () => {
            const stream = await budgetStreamData.insert(FinanceEntityFactory.createBudgetStream(testUserId, { categoryId: testCategoryId,
                name: 'Utilities',
                type: BudgetStreamType.Expense,
                recurrence: CalendarPeriod.Monthly,
                amount: 150.00
            }));

            const response = await request(app).delete(`/budget-streams/${stream.id}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const dbStream = await budgetStreamData.retrieveSingle(stream.id!);
            expect(dbStream).toBeNull();
        });
    });
});
