import express from 'express';
import request from 'supertest';
import { CalendarPeriod, SortDirection } from '@shared/common/enum';
import { TransactionsSortKey } from '@shared/finance/enum';
import { Transaction } from '@shared/finance/types';
import { AppLogger } from '@core/logger';
import { DateTimeUtil } from '@core/utility';
import { TestExpressUtil } from '@test/express-util';
import { FinanceMockUtil } from '@test/finance-mocks';

import { IFinanceTransactionsData } from './../data/transactions-data';
import { createTransactionRouter } from './transaction-routes';

describe('Transaction Routes', () => {
    let app: express.Express;
    let mockTransactionsData: jest.Mocked<IFinanceTransactionsData>;
    let mockLogger: jest.Mocked<AppLogger>;

    const testUserId = 'test-user-id';

    const createMockTransaction = (overrides?: Partial<Transaction>): Transaction => {
        return {
            id: 'txn-1',
            accountId: 'acc-1',
            categoryId: 'cat-1',
            date: '2026-06-06',
            amount: 150.00,
            merchant: 'Test Merchant',
            originalStatement: 'Test Merchant',
            notes: '',
            isHidden: false,
            isSplit: false,
            splitParentId: '',
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now(),
            ...overrides
        };
    };

    beforeEach(() => {
        mockTransactionsData = FinanceMockUtil.createMockTransactionsData();
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createTransactionRouter(mockTransactionsData, mockLogger);
        app = TestExpressUtil.createTestApp(router, '/transactions', testUserId);
    });

    describe('GET /', () => {
        it('should return a list of transactions when successful with default options', async () => {
            const mockTxns = [
                createMockTransaction({ id: 'txn-1', amount: 100 }),
                createMockTransaction({ id: 'txn-2', amount: 200 })
            ];
            mockTransactionsData.search.mockResolvedValue(mockTxns);

            const response = await request(app).get('/transactions');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(mockTxns)));
            expect(mockTransactionsData.search).toHaveBeenCalledWith(testUserId, expect.objectContaining({
                sortKey: undefined,
                sortDirection: undefined,
                offset: 0,
                limit: 50,
                includeHidden: false
            }), undefined);
        });

        it('should parse and pass all search options correctly', async () => {
            mockTransactionsData.search.mockResolvedValue([]);

            const filters = [
                { filterKey: 'categoryId', value: 'cat-1' },
                { filterKey: 'merchant', value: 'Amazon' },
                { filterKey: 'search', value: 'Test' }
            ];

            const response = await request(app)
                .get('/transactions')
                .query({
                    sortKey: TransactionsSortKey.Amount,
                    sortDirection: SortDirection.Desc,
                    offset: '10',
                    limit: '25',
                    includeHidden: 'true',
                    minAmount: '50',
                    maxAmount: '500',
                    startDate: '2026-01-01',
                    endDate: '2026-12-31',
                    filters: JSON.stringify(filters)
                });

            expect(response.status).toBe(200);
            expect(mockTransactionsData.search).toHaveBeenCalledWith(testUserId, expect.objectContaining({
                sortKey: TransactionsSortKey.Amount,
                sortDirection: SortDirection.Desc,
                offset: 10,
                limit: 25,
                includeHidden: true,
                minAmount: 50,
                maxAmount: 500,
                startDate: '2026-01-01',
                endDate: '2026-12-31',
                filters: filters
            }), undefined);
        });
    });

    describe('POST /', () => {
        it('should create a new transaction when input is valid', async () => {
            const payload = {
                accountId: 'acc-1',
                categoryId: 'cat-1',
                date: '2026-06-06',
                amount: 300.00,
                merchant: 'Groceries'
            };
            const createdTxn = createMockTransaction({ ...payload, id: 'generated-id' });
            mockTransactionsData.insert.mockResolvedValue(createdTxn);

            const response = await request(app)
                .post('/transactions')
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(createdTxn)));
            expect(mockTransactionsData.insert).toHaveBeenCalledWith(
                testUserId,
                expect.objectContaining(payload)
            );
        });

        it('should return 400 when schema validation fails (missing amount)', async () => {
            const payload = {
                accountId: 'acc-1',
                categoryId: 'cat-1',
                date: '2026-06-06',
                merchant: 'Groceries'
            };

            const response = await request(app)
                .post('/transactions')
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(mockTransactionsData.insert).not.toHaveBeenCalled();
        });
    });

    describe('GET /merchants', () => {
        it('should return a list of merchants', async () => {
            const merchants = ['Amazon', 'Walmart'];
            mockTransactionsData.retrieveMerchants.mockResolvedValue(merchants);

            const response = await request(app).get('/transactions/merchants');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(merchants);
        });
    });

    describe('GET /spending', () => {
        it('should return spending by category', async () => {
            const spending = [{ categoryId: 'cat-1', amount: 500 }];
            mockTransactionsData.retrieveSpendingByCategory.mockResolvedValue(spending);

            const response = await request(app).get('/transactions/spending?period=Monthly');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(spending);
            expect(mockTransactionsData.retrieveSpendingByCategory).toHaveBeenCalled();
        });
    });

    describe('GET /:id', () => {
        it('should return a single transaction when found', async () => {
            const txn = createMockTransaction({ id: 'txn-1' });
            mockTransactionsData.retrieveSingle.mockResolvedValue(txn);

            const response = await request(app).get('/transactions/txn-1');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(txn)));
        });

        it('should return 400 when transaction is not found', async () => {
            mockTransactionsData.retrieveSingle.mockResolvedValue(null);

            const response = await request(app).get('/transactions/missing-id');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /:id', () => {
        it('should update a transaction when valid and resource belongs to user', async () => {
            const txnId = 'txn-1';
            const payload = {
                amount: 120.00,
                merchant: 'Updated Merchant'
            };
            const updatedTxn = createMockTransaction({ ...payload, id: txnId });
            mockTransactionsData.update.mockResolvedValue(updatedTxn);

            const response = await request(app)
                .put(`/transactions/${txnId}`)
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(updatedTxn)));
        });

        it('should return 400 when update fails because resource does not exist or user lacks ownership', async () => {
            mockTransactionsData.update.mockResolvedValue(null);

            const response = await request(app)
                .put('/transactions/txn-1')
                .send({ merchant: 'Updated' });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found or access denied');
        });
    });

    describe('DELETE /:id', () => {
        it('should delete a transaction when resource belongs to user', async () => {
            mockTransactionsData.delete.mockResolvedValue(true);

            const response = await request(app).delete('/transactions/txn-1');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(mockTransactionsData.delete).toHaveBeenCalledWith(testUserId, 'txn-1');
        });

        it('should return 400 when delete fails', async () => {
            mockTransactionsData.delete.mockResolvedValue(false);

            const response = await request(app).delete('/transactions/txn-1');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found or access denied');
        });
    });
});
