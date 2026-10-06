import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { CalendarPeriod } from '@shared/core/enum/calendar-period';
import { CategoryType } from '@shared/finance/enum';
import { BudgetStreamType } from '@shared/finance/enum/budget-stream-type';
import { DatabaseClient, FinanceEntityFactory } from '@server/data';
import { IAppLogger } from '@server/logging';
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
    let mockLogger: jest.Mocked<IAppLogger>;
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

        const group = await groupsData.insert(
            FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'General' })
        );
        const category = await categoriesData.insert(
            FinanceEntityFactory.createCategory({ groupId: group.id, name: 'Misc', icon: '⭐', isActive: true })
        );
        testCategoryId = category.id!;
    });

    describe('GET /', () => {
        it('BUD-1.2 should return every budget stream', async () => {
            const stream1 = await budgetStreamData.insert(
                FinanceEntityFactory.createBudgetStream({
                    categoryId: testCategoryId,
                    name: 'Utilities',
                    recurrence: CalendarPeriod.Monthly,
                    amount: 150.0
                })
            );
            const stream2 = await budgetStreamData.insert(
                FinanceEntityFactory.createBudgetStream({
                    categoryId: testCategoryId,
                    name: 'Salary',
                    recurrence: CalendarPeriod.Monthly,
                    amount: 5000.0
                })
            );

            const response = await request(app).get('/budget-streams');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map((s: any) => s.id)).toEqual(expect.arrayContaining([stream1.id, stream2.id]));
        });
    });

    describe('POST /', () => {
        it('BUD-1.3 should create a new budget stream when input is valid', async () => {
            const payload = {
                name: 'Groceries',
                categoryId: testCategoryId,
                recurrence: CalendarPeriod.Monthly,
                amount: 300.0
            };

            const response = await request(app).post('/budget-streams').send(payload);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Groceries');

            const dbStream = await budgetStreamData.retrieveSingle(response.body.id);
            expect(dbStream).not.toBeNull();
            expect(dbStream?.name).toBe('Groceries');
        });

        it('BUD-1.1 should return 400 when the name is missing or longer than 100 characters', async () => {
            const payload = {
                categoryId: testCategoryId,
                recurrence: CalendarPeriod.Monthly,
                amount: 300.0
            };

            const response = await request(app).post('/budget-streams').send(payload);
            const tooLong = await request(app)
                .post('/budget-streams')
                .send({ ...payload, name: 'x'.repeat(101) });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('name:');
            expect(tooLong.status).toBe(400);
            expect(tooLong.body.message).toContain('name:');
        });
    });

    describe('type', () => {
        async function categoryOfType(categoryType: CategoryType, name: string): Promise<string> {
            const group = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: categoryType, name: `${name} group` })
            );
            const category = await categoriesData.insert(
                FinanceEntityFactory.createCategory({ groupId: group.id, name, icon: '⭐', isActive: true })
            );
            return category.id;
        }

        it('BUD-1.1 should follow from the category: Income, Expense, or Savings for a Transfer', async () => {
            const categories = [
                await categoryOfType(CategoryType.Income, 'Paycheck'),
                testCategoryId,
                await categoryOfType(CategoryType.Transfer, 'Savings Transfer')
            ];

            const types = [];
            for (const categoryId of categories) {
                const response = await request(app).post('/budget-streams').send({
                    name: 'Stream',
                    categoryId,
                    recurrence: CalendarPeriod.Monthly,
                    amount: 100,
                    type: BudgetStreamType.Income
                });
                expect(response.status).toBe(201);
                types.push(response.body.type);
            }

            expect(types).toEqual([BudgetStreamType.Income, BudgetStreamType.Expense, BudgetStreamType.Savings]);
        });

        it('BUD-1.1 should change with the category', async () => {
            const stream = await budgetStreamData.insert(
                FinanceEntityFactory.createBudgetStream({
                    categoryId: testCategoryId,
                    name: 'Emergency fund',
                    recurrence: CalendarPeriod.Monthly,
                    amount: 500
                })
            );
            const savings = await categoryOfType(CategoryType.Transfer, 'Savings Transfer');

            const response = await request(app).put(`/budget-streams/${stream.id}`).send({ categoryId: savings });

            expect(response.status).toBe(200);
            expect(response.body.type).toBe(BudgetStreamType.Savings);
        });

        it('CAT-1.18 should follow the category into a group of another type', async () => {
            const stream = await budgetStreamData.insert(
                FinanceEntityFactory.createBudgetStream({
                    categoryId: testCategoryId,
                    name: 'Side job',
                    recurrence: CalendarPeriod.Monthly,
                    amount: 200
                })
            );
            const income = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Income, name: 'Work' })
            );
            const category = (await categoriesData.retrieveSingle(testCategoryId))!;
            await categoriesData.update({ ...category, groupId: income.id });

            const response = await request(app).get('/budget-streams');

            expect(response.body).toEqual([expect.objectContaining({ id: stream.id, type: BudgetStreamType.Income })]);
        });

        it('BUD-1.1 should reject a category that does not exist', async () => {
            const response = await request(app)
                .post('/budget-streams')
                .send({ name: 'Stream', categoryId: 'missing', recurrence: CalendarPeriod.Monthly, amount: 100 });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Category not found.');
        });
    });

    describe('PUT /:id', () => {
        it('BUD-1.4 should update a budget stream when valid', async () => {
            const stream = await budgetStreamData.insert(
                FinanceEntityFactory.createBudgetStream({
                    categoryId: testCategoryId,
                    name: 'Utilities',
                    recurrence: CalendarPeriod.Monthly,
                    amount: 150.0
                })
            );

            const payload = { ...stream, amount: 180.0 };

            const response = await request(app).put(`/budget-streams/${stream.id}`).send(payload);

            expect(response.status).toBe(200);
            expect(response.body.amount).toBe(180.0);

            const dbStream = await budgetStreamData.retrieveSingle(stream.id!);
            expect(dbStream?.amount).toBe(180.0);
        });

        it('BUD-1.4 should change only the fields sent', async () => {
            const stream = await budgetStreamData.insert(
                FinanceEntityFactory.createBudgetStream({
                    categoryId: testCategoryId,
                    name: 'Utilities',
                    recurrence: CalendarPeriod.Quarterly,
                    amount: 150
                })
            );

            const response = await request(app).put(`/budget-streams/${stream.id}`).send({ name: 'Power' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual(
                expect.objectContaining({
                    name: 'Power',
                    amount: 150,
                    recurrence: CalendarPeriod.Quarterly,
                    categoryId: testCategoryId
                })
            );
        });

        it('BUD-1.4 should return 404 when update target does not exist', async () => {
            const response = await request(app).put('/budget-streams/missing').send({ name: 'Power' });

            expect(response.status).toBe(404);
        });
    });

    describe('field rules', () => {
        it.each([
            [{ amount: -1 }, 'amount:'],
            [{ amount: 1e10 }, 'amount:'],
            [{ categoryId: '' }, 'categoryId:'],
            [{ categoryId: undefined }, 'categoryId:']
        ])('BUD-1.1 should reject %p', async (override, message) => {
            const payload = {
                categoryId: testCategoryId,
                name: 'Rent',
                recurrence: CalendarPeriod.Monthly,
                amount: 100,
                ...override
            };

            const response = await request(app).post('/budget-streams').send(payload);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain(message);
        });
    });

    describe('DELETE /:id', () => {
        it('BUD-1.4 should delete a budget stream', async () => {
            const stream = await budgetStreamData.insert(
                FinanceEntityFactory.createBudgetStream({
                    categoryId: testCategoryId,
                    name: 'Utilities',
                    recurrence: CalendarPeriod.Monthly,
                    amount: 150.0
                })
            );

            const response = await request(app).delete(`/budget-streams/${stream.id}`);

            expect(response.status).toBe(204);

            const dbStream = await budgetStreamData.retrieveSingle(stream.id!);
            expect(dbStream).toBeNull();
        });

        it('BUD-1.4 should return 404 when delete target does not exist', async () => {
            const response = await request(app).delete('/budget-streams/missing-stream');

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });
    });
});
