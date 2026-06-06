import express from 'express';
import request from 'supertest';
import { AccountCategory, AccountGroup, AccountType, ValueHistoryType } from '@shared/finance/enum';
import { Account } from '@shared/finance/types';
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

    const createMockAccount = (overrides?: Partial<Account>): Account => {
        return {
            id: 'acc1',
            userId: testUserId,
            institutionId: 'inst1',
            name: 'Checking Account',
            category: AccountCategory.Asset,
            group: AccountGroup.Cash,
            type: AccountType.Checking,
            balance: 1000.00,
            isHidden: false,
            isManual: false,
            isRetirement: false,
            hideFromCashflow: false,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...overrides
        } as Account;
    };

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
                createMockAccount({ id: 'acc1', name: 'Checking' }),
                createMockAccount({ id: 'acc2', name: 'Savings', type: AccountType.Savings })
            ];
            mockAccountData.retrieveAll.mockResolvedValue(mockAccounts);

            const response = await request(app).get('/accounts');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(mockAccounts)));
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

    describe('GET /accounts/total-value-history', () => {
        it('should return total value history when successful', async () => {
            const mockSumHistory = [
                { balance: 2500.00, date: new Date().toISOString() }
            ];
            mockBalanceHistoryData.retrieveSumByDate.mockResolvedValue(mockSumHistory as any);

            const response = await request(app).get('/accounts/total-value-history?type=NetWorth&timeframe=PastThirtyDays');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(mockSumHistory)));
            expect(mockBalanceHistoryData.retrieveSumByDate).toHaveBeenCalledWith(
                testUserId,
                ValueHistoryType.NetWorth,
                expect.any(Date),
                expect.any(Date)
            );
        });
    });

    describe('GET /accounts/:accountId', () => {
        it('should return a single account when found', async () => {
            const mockAccount = createMockAccount({ id: 'acc1', name: 'Checking' });
            mockAccountData.retrieveSingle.mockResolvedValue(mockAccount);

            const response = await request(app).get('/accounts/acc1');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(mockAccount)));
            expect(mockAccountData.retrieveSingle).toHaveBeenCalledWith(testUserId, 'acc1');
        });

        it('should return 400 when account is not found', async () => {
            mockAccountData.retrieveSingle.mockResolvedValue(null);

            const response = await request(app).get('/accounts/missing');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found');
        });
    });

    describe('POST /accounts', () => {
        it('should create a new account', async () => {
            const payload = {
                name: 'New Account',
                institutionId: 'inst1',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                isHidden: false,
                isManual: true,
                isRetirement: false,
                hideFromCashflow: false
            };
            const createdAccount = createMockAccount({ ...payload, id: 'new-acc-id' });
            mockAccountData.create.mockResolvedValue(createdAccount);

            const response = await request(app)
                .post('/accounts')
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(createdAccount)));
            expect(mockAccountData.create).toHaveBeenCalledWith(testUserId, expect.objectContaining(payload));
        });

        it('should return 400 when schema validation fails (missing category)', async () => {
            const payload = {
                name: 'New Account',
                institutionId: 'inst1',
                group: AccountGroup.Cash
            };

            const response = await request(app)
                .post('/accounts')
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('category:');
            expect(response.body.error.message).toContain('expected string');
            expect(mockAccountData.create).not.toHaveBeenCalled();
        });
    });

    describe('PUT /accounts/:accountId', () => {
        it('should update an account when input is valid and resource belongs to user', async () => {
            const accountId = 'acc1';
            const payload = {
                name: 'Updated Checking',
                institutionId: 'inst1',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                isHidden: false,
                isManual: true,
                isRetirement: false,
                hideFromCashflow: false
            };
            const updatedAccount = createMockAccount({ ...payload, id: accountId });
            mockAccountData.update.mockResolvedValue(updatedAccount);

            const response = await request(app)
                .put(`/accounts/${accountId}`)
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(updatedAccount)));
            expect(mockAccountData.update).toHaveBeenCalledWith(
                testUserId,
                expect.objectContaining({ ...payload, id: accountId })
            );
        });

        it('should return 400 when update fails because resource does not exist or user lacks ownership', async () => {
            const accountId = 'unowned-acc';
            const payload = {
                name: 'Updated Checking',
                institutionId: 'inst1',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                isHidden: false,
                isManual: true,
                isRetirement: false,
                hideFromCashflow: false
            };
            mockAccountData.update.mockResolvedValue(null);

            const response = await request(app)
                .put(`/accounts/${accountId}`)
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found or access denied');
        });
    });

    describe('DELETE /accounts/:accountId', () => {
        it('should delete an account when resource belongs to user', async () => {
            const accountId = 'acc1';
            mockAccountData.delete.mockResolvedValue(true);

            const response = await request(app).delete(`/accounts/${accountId}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(mockAccountData.delete).toHaveBeenCalledWith(testUserId, accountId);
        });

        it('should return 400 when delete fails because resource does not exist or user lacks ownership', async () => {
            const accountId = 'unowned-acc';
            mockAccountData.delete.mockResolvedValue(false);

            const response = await request(app).delete(`/accounts/${accountId}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found or access denied');
        });
    });

    describe('GET /accounts/:accountId/balance-history', () => {
        it('should return balance history for an account when successful', async () => {
            const mockHistory = [
                { id: 'h1', accountId: 'acc1', balance: 500.00, date: new Date().toISOString() }
            ];
            mockBalanceHistoryData.retrieveForAccount.mockResolvedValue(mockHistory as any);

            const response = await request(app).get('/accounts/acc1/balance-history?timeframe=PastThirtyDays');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(mockHistory)));
            expect(mockBalanceHistoryData.retrieveForAccount).toHaveBeenCalledWith(
                testUserId,
                'acc1',
                expect.any(String),
                expect.any(String)
            );
        });
    });

    describe('GET /accounts/:accountId/transactions', () => {
        it('should return transactions for an account when successful', async () => {
            const mockTransactions = [
                { id: 't1', amount: 50.00, date: new Date().toISOString(), merchant: 'Store' }
            ];
            mockTransactionsData.search.mockResolvedValue(mockTransactions as any);

            const response = await request(app).get('/accounts/acc1/transactions');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockTransactions);
            expect(mockTransactionsData.search).toHaveBeenCalledWith(
                testUserId,
                expect.any(Object),
                'acc1'
            );
        });
    });
});
