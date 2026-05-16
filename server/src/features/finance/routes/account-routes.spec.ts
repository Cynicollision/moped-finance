import express from 'express';
import request from 'supertest';
import { AppLogger } from '@core/logger';
import { TestExpressUtil } from '@test/express-util';
import { FinanceMockUtil } from '@test/finance-mocks';
import { IFinanceAccountData } from './../data/account-data';
import { IFinanceBalanceHistoryData } from './../data/balance-history-data';
import { IFinanceTransactionsData } from './../data/transactions-data';
import { createAccountRouter } from './account-routes';

describe('Account Routes', () => {
    let app: express.Express;
    let mockAccountData: jest.Mocked<IFinanceAccountData>;
    let mockBalanceHistoryData: jest.Mocked<IFinanceBalanceHistoryData>;
    let mockTransactionsData: jest.Mocked<IFinanceTransactionsData>;
    let mockLogger: jest.Mocked<AppLogger>;

    const testUserId = 'test-user-id';

    beforeEach(() => {
        mockAccountData = FinanceMockUtil.createMockAccountData();
        mockBalanceHistoryData = FinanceMockUtil.createMockBalanceHistoryData();
        mockTransactionsData = FinanceMockUtil.createMockTransactionsData();

        mockLogger = TestExpressUtil.createMockLogger();

        const router = createAccountRouter(mockAccountData, mockBalanceHistoryData, mockTransactionsData, mockLogger);
        app = TestExpressUtil.createTestApp(router, '/accounts', testUserId);
    });

    describe('GET /accounts', () => {
        it('should return a list of accounts when successful', async () => {
            const mockAccounts = [
                { id: 'acc1', name: 'Checking', userId: testUserId },
                { id: 'acc2', name: 'Savings', userId: testUserId }
            ];
            mockAccountData.retrieveAll.mockResolvedValue(mockAccounts as any);

            const response = await request(app).get('/accounts');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockAccounts);
            expect(mockAccountData.retrieveAll).toHaveBeenCalledWith(testUserId);
        });

        it('should return 500 when an internal error occurs', async () => {
            mockAccountData.retrieveAll.mockRejectedValue(new Error('DB Error'));

            const response = await request(app).get('/accounts');

            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toBeDefined();
        });
    });

    describe('GET /accounts/:accountId', () => {
        it('should return a single account when found', async () => {
            const mockAccount = { id: 'acc1', name: 'Checking', userId: testUserId };
            mockAccountData.retrieveSingle.mockResolvedValue(mockAccount as any);

            const response = await request(app).get('/accounts/acc1');

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual(mockAccount);
            expect(mockAccountData.retrieveSingle).toHaveBeenCalledWith(testUserId, 'acc1');
        });

        it('should return 400 when account is not found', async () => {
            mockAccountData.retrieveSingle.mockResolvedValue(null as any);

            const response = await request(app).get('/accounts/missing');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found');
        });
    });

    describe('POST /accounts', () => {
        it('should create a new account', async () => {
            const newAccount = { name: 'New Account', institutionId: 'inst1' };
            const createdAccount = { ...newAccount, id: 'new-acc-id', userId: testUserId };
            mockAccountData.create.mockResolvedValue(createdAccount as any);

            const response = await request(app)
                .post('/accounts')
                .send(newAccount);

            expect(response.status).toBe(200);
            expect(response.body.data).toEqual(createdAccount);
            expect(mockAccountData.create).toHaveBeenCalledWith(testUserId, expect.objectContaining(newAccount));
        });
    });
});
