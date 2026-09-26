import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { CalendarPeriod } from '@shared/core/enum/calendar-period';
import { CategoryClass } from '@shared/finance/enum';
import { BudgetStreamType } from '@shared/finance/enum/budget-stream-type';
import { DatabaseClient, FinanceEntityFactory } from '@server/data';
import { AppLogger } from '@server/logging';
import { TestExpressUtil, TestDatabaseUtil } from '@server/utility/testing';
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
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    beforeEach(async () => {
        await TestDatabaseUtil.clearFinanceData(pglite);

        const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup({ class: CategoryClass.Expense, name: 'General' }));
        const category = await categoriesData.insert(FinanceEntityFactory.createCategory({ groupId: group.id, name: 'Misc', icon: 'star', isActive: true }));
        testCategoryId = category.id!;
    });

    describe('GET /', () => {
        it('should return a list of budget streams when successful', async () => {
            const stream1 = await budgetStreamData.insert(FinanceEntityFactory.createBudgetStream({
                categoryId: testCategoryId,
                name: 'Utilities',
                type: BudgetStreamType.Expense,
                recurrence: CalendarPeriod.Monthly,
                amount: 150.00
            }));
            const stream2 = await budgetStreamData.insert(FinanceEntityFactory.createBudgetStream({
                categoryId: testCategoryId,
                name: 'Salary',
                type: BudgetStreamType.Income,
                recurrence: CalendarPeriod.Monthly,
                amount: 5000.00
            }));

            const response = await request(app).get('/budget-streams');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map((s: any) => s.id)).toEqual(expect.arrayContaining([stream1.id, stream2.id]));
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

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Groceries');

            const dbStream = await budgetStreamData.retrieveSingle(response.body.id);
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
            expect(response.body.message).toContain('name:');
        });
    });

    describe('PUT /:id', () => {
        it('should update a budget stream when valid', async () => {
            const stream = await budgetStreamData.insert(FinanceEntityFactory.createBudgetStream({
                categoryId: testCategoryId,
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
            expect(response.body.amount).toBe(180.00);

            const dbStream = await budgetStreamData.retrieveSingle(stream.id!);
            expect(dbStream?.amount).toBe(180.00);
        });
    });

    describe('DELETE /:id', () => {
        it('should delete a budget stream', async () => {
            const stream = await budgetStreamData.insert(FinanceEntityFactory.createBudgetStream({
                categoryId: testCategoryId,
                name: 'Utilities',
                type: BudgetStreamType.Expense,
                recurrence: CalendarPeriod.Monthly,
                amount: 150.00
            }));

            const response = await request(app).delete(`/budget-streams/${stream.id}`);

            expect(response.status).toBe(204);

            const dbStream = await budgetStreamData.retrieveSingle(stream.id!);
            expect(dbStream).toBeNull();
        });

        it('should return 404 when delete target does not exist', async () => {
            const response = await request(app).delete('/budget-streams/missing-stream');

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });
    });
});
