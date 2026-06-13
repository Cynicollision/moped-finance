import express from 'express';
import request from 'supertest';
import { CalendarPeriod } from '@shared/core/enum/calendar-period';
import { BudgetStreamType } from '@shared/finance/enum/budget-stream-type';
import { BudgetStream } from '@shared/finance/types';
import { AppLogger } from '@server-core/logger';
import { DateTimeUtil } from '@server-core/utility';
import { TestExpressUtil } from '@server-core/utility/testing';
import { FinanceMockUtil } from './../finance-mocks';
import { IFinanceBudgetStreamData } from './budget-stream-data';
import { createBudgetStreamRouter } from './budget-stream-routes';

describe('Budget Stream Routes', () => {
    let app: express.Express;
    let mockBudgetStreamData: jest.Mocked<IFinanceBudgetStreamData>;
    let mockLogger: jest.Mocked<AppLogger>;

    const testUserId = 'test-user-id';

    const createMockBudgetStream = (overrides?: Partial<BudgetStream>): BudgetStream => {
        return {
            id: 'bs-1',
            userId: testUserId,
            name: 'Utilities',
            categoryId: 'cat-1',
            type: BudgetStreamType.Expense,
            recurrence: CalendarPeriod.Monthly,
            amount: 150.00,
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now(),
            ...overrides
        };
    };

    beforeEach(() => {
        mockBudgetStreamData = FinanceMockUtil.createMockBudgetStreamData();
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createBudgetStreamRouter(mockLogger, mockBudgetStreamData);
        app = TestExpressUtil.createTestApp(router, '/budget-streams', testUserId);
    });

    describe('GET /', () => {
        it('should return a list of budget streams when successful', async () => {
            const mockStreams = [
                createMockBudgetStream({ id: 'bs-1', name: 'Utilities' }),
                createMockBudgetStream({ id: 'bs-2', name: 'Salary', type: BudgetStreamType.Income })
            ];
            mockBudgetStreamData.retrieveAll.mockResolvedValue(mockStreams);

            const response = await request(app).get('/budget-streams');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(mockStreams)));
            expect(mockBudgetStreamData.retrieveAll).toHaveBeenCalledWith(testUserId);
        });

        it('should return empty list when database query fails', async () => {
            mockBudgetStreamData.retrieveAll.mockRejectedValue(new Error('Database error'));

            const response = await request(app).get('/budget-streams');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual([]);
        });
    });

    describe('POST /', () => {
        it('should create a new budget stream when input is valid', async () => {
            const payload = {
                name: 'Groceries',
                categoryId: 'cat-groceries',
                type: BudgetStreamType.Expense,
                recurrence: CalendarPeriod.Monthly,
                amount: 300.00
            };
            const createdStream = createMockBudgetStream({ ...payload, id: 'generated-id' });
            mockBudgetStreamData.insert.mockResolvedValue(createdStream);

            const response = await request(app)
                .post('/budget-streams')
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(createdStream)));
            expect(mockBudgetStreamData.insert).toHaveBeenCalledWith(
                testUserId,
                expect.objectContaining(payload)
            );
        });

        it('should return 400 when schema validation fails (missing name)', async () => {
            const payload = {
                categoryId: 'cat-groceries',
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
            expect(response.body.error.message).toContain('expected string');
            expect(mockBudgetStreamData.insert).not.toHaveBeenCalled();
        });

        it('should return 400 when schema validation fails (empty categoryId)', async () => {
            const payload = {
                name: 'Groceries',
                categoryId: '',
                type: BudgetStreamType.Expense,
                recurrence: CalendarPeriod.Monthly,
                amount: 300.00
            };

            const response = await request(app)
                .post('/budget-streams')
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(mockBudgetStreamData.insert).not.toHaveBeenCalled();
        });

        it('should return 400 when schema validation fails (non-finite amount)', async () => {
            const payload = {
                name: 'Groceries',
                categoryId: 'cat-groceries',
                type: BudgetStreamType.Expense,
                recurrence: CalendarPeriod.Monthly,
                amount: Infinity
            };

            const response = await request(app)
                .post('/budget-streams')
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(mockBudgetStreamData.insert).not.toHaveBeenCalled();
        });
    });

    describe('PUT /:id', () => {
        it('should update a budget stream when valid and resource belongs to the user', async () => {
            const streamId = 'bs-1';
            const payload = {
                name: 'Electric Bill',
                categoryId: 'cat-utilities',
                type: BudgetStreamType.Expense,
                recurrence: CalendarPeriod.Monthly,
                amount: 120.00
            };
            const updatedStream = createMockBudgetStream({ ...payload, id: streamId });
            mockBudgetStreamData.update.mockResolvedValue(updatedStream);

            const response = await request(app)
                .put(`/budget-streams/${streamId}`)
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(updatedStream)));
            expect(mockBudgetStreamData.update).toHaveBeenCalledWith(
                testUserId,
                expect.objectContaining({ ...payload, id: streamId })
            );
        });

        it('should return 400 when update body validation fails (invalid amount type)', async () => {
            const streamId = 'bs-1';
            const payload = {
                amount: 'one hundred'
            };

            const response = await request(app)
                .put(`/budget-streams/${streamId}`)
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(mockBudgetStreamData.update).not.toHaveBeenCalled();
        });

        it('should return 400 when update fails because resource does not exist or user lacks ownership', async () => {
            const streamId = 'unowned-bs-id';
            const payload = {
                name: 'Electric Bill',
                categoryId: 'cat-utilities',
                type: BudgetStreamType.Expense,
                recurrence: CalendarPeriod.Monthly,
                amount: 120.00
            };
            mockBudgetStreamData.update.mockResolvedValue(null);

            const response = await request(app)
                .put(`/budget-streams/${streamId}`)
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found or access denied');
            expect(mockBudgetStreamData.update).toHaveBeenCalledWith(
                testUserId,
                expect.objectContaining({ ...payload, id: streamId })
            );
        });
    });

    describe('DELETE /:id', () => {
        it('should delete a budget stream when resource belongs to the user', async () => {
            const streamId = 'bs-1';
            mockBudgetStreamData.delete.mockResolvedValue(true);

            const response = await request(app).delete(`/budget-streams/${streamId}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(mockBudgetStreamData.delete).toHaveBeenCalledWith(testUserId, streamId);
        });

        it('should return 400 when delete fails because resource does not exist or user lacks ownership', async () => {
            const streamId = 'unowned-bs-id';
            mockBudgetStreamData.delete.mockResolvedValue(false);

            const response = await request(app).delete(`/budget-streams/${streamId}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found or access denied');
            expect(mockBudgetStreamData.delete).toHaveBeenCalledWith(testUserId, streamId);
        });
    });
});
