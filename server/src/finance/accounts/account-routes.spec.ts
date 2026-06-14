import express from 'express';
import request from 'supertest';
import { AccountCategory, AccountGroup, AccountType, TransactionsSortKey, ValueHistoryType } from '@shared/finance/enum';
import { SortDirection } from '@shared/core/enum';
import { Account } from '@shared/finance/types';
import { AppLogger } from '@server-core/logger';
import { DateTimeUtil } from '@server-core/utility';
import { TestExpressUtil } from '@server-core/utility/testing';
import { FinanceMockUtil } from './../finance-mocks';
import { IFinanceAccountData } from './account-data';
import { createAccountRouter } from './account-routes';
import { IFinanceBalanceHistoryData } from './balance-history-data';
import { IFinanceTransactionData } from './../transactions';
import { IFinanceCategoryData } from './../categories/category-data';

describe('Account Routes', () => {
    let app: express.Express;
    let mockAccountData: jest.Mocked<IFinanceAccountData>;
    let mockBalanceHistoryData: jest.Mocked<IFinanceBalanceHistoryData>;
    let mockTransactionsData: jest.Mocked<IFinanceTransactionData>;
    let mockCategoriesData: jest.Mocked<IFinanceCategoryData>;
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
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now(),
            ...overrides
        } as Account;
    };

    beforeEach(() => {
        mockAccountData = FinanceMockUtil.createMockAccountData();
        mockBalanceHistoryData = FinanceMockUtil.createMockBalanceHistoryData();
        mockTransactionsData = FinanceMockUtil.createMockTransactionsData();
        mockLogger = TestExpressUtil.createMockLogger();
        mockCategoriesData = FinanceMockUtil.createMockCategoriesData();

        const router = createAccountRouter(mockLogger, mockAccountData, mockBalanceHistoryData, mockCategoriesData, mockTransactionsData);
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
        it('should return total value history with specific options', async () => {
            const mockSumHistory = [
                { balance: 2500.00, date: DateTimeUtil.nowToISOString() }
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

        it('should use default timeframe and asOfDate when not provided', async () => {
            mockBalanceHistoryData.retrieveSumByDate.mockResolvedValue([]);

            const response = await request(app).get('/accounts/total-value-history');

            expect(response.status).toBe(200);
            expect(mockBalanceHistoryData.retrieveSumByDate).toHaveBeenCalledWith(
                testUserId,
                ValueHistoryType.NetWorth, // NetWorth is default if not provided
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
        it('should return balance history for an account with default timeframe', async () => {
            const mockHistory = [
                { id: 'h1', accountId: 'acc1', balance: 500.00, date: DateTimeUtil.nowToISOString() }
            ];
            mockBalanceHistoryData.retrieveForAccount.mockResolvedValue(mockHistory as any);

            const response = await request(app).get('/accounts/acc1/balance-history');

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

        it('should parse timeframe and asOfDate query parameters correctly', async () => {
            mockBalanceHistoryData.retrieveForAccount.mockResolvedValue([]);

            const response = await request(app)
                .get('/accounts/acc1/balance-history')
                .query({
                    timeframe: 'PastThirtyDays',
                    asOfDate: '2026-06-01'
                });

            expect(response.status).toBe(200);
            expect(mockBalanceHistoryData.retrieveForAccount).toHaveBeenCalledWith(
                testUserId,
                'acc1',
                expect.any(String), // startDate (calculated based on PastThirtyDays and asOfDate)
                expect.any(String)  // endDate (calculated based on PastThirtyDays and asOfDate)
            );
        });
    });

    describe('GET /accounts/:accountId/transactions', () => {
        it('should return transactions for an account with default options', async () => {
            const mockTransactions = [
                { id: 't1', amount: 50.00, date: DateTimeUtil.nowToISOString(), merchant: 'Store' }
            ];
            mockTransactionsData.search.mockResolvedValue(mockTransactions as any);

            const response = await request(app).get('/accounts/acc1/transactions');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(mockTransactions);
            expect(mockTransactionsData.search).toHaveBeenCalledWith(
                testUserId,
                expect.objectContaining({
                    offset: 0,
                    limit: 50,
                    includeHidden: false
                }),
                'acc1'
            );
        });

        it('should pass search options to transaction search properly', async () => {
            mockTransactionsData.search.mockResolvedValue([]);

            const response = await request(app)
                .get('/accounts/acc1/transactions')
                .query({
                    sortKey: TransactionsSortKey.Date,
                    sortDirection: SortDirection.Asc,
                    limit: '10',
                    offset: '20',
                    includeHidden: 'true',
                    minAmount: '100'
                });

            expect(response.status).toBe(200);
            expect(mockTransactionsData.search).toHaveBeenCalledWith(
                testUserId,
                expect.objectContaining({
                    sortKey: TransactionsSortKey.Date,
                    sortDirection: SortDirection.Asc,
                    limit: 10,
                    offset: 20,
                    includeHidden: true,
                    minAmount: 100
                }),
                'acc1'
            );
        });
    });

    describe('GET /:accountId/export-balances', () => {
        it('should return a CSV file of exported balances', async () => {
            mockBalanceHistoryData.exportSearch.mockResolvedValue([
                { Date: '2026-06-06', AccountName: 'Checking', Balance: 100 }
            ]);

            const response = await request(app).get('/accounts/acc1/export-balances');

            expect(response.status).toBe(200);
            expect(response.header['content-type']).toContain('text/csv');
            expect(response.text).toContain('Date,AccountName,Balance');
            expect(response.text).toContain('2026-06-06');
        });
    });

    describe('POST /:accountId/import-balances', () => {
        it('should process a CSV file and return import statistics', async () => {
            mockAccountData.retrieveSingle.mockResolvedValue({ id: 'acc1', name: 'Checking', category: 'Asset', group: 'Cash', type: 'Checking', balance: 0, userId: testUserId, isHidden: false, isManual: false, isRetirement: false, hideFromCashflow: false, createdAt: new Date(), updatedAt: new Date(), institutionId: '' } as any);
            mockBalanceHistoryData.insertBulk.mockResolvedValue(true);

            const csvContent = 'Date,Balance,AccountName\n2026-06-06,100,Checking';

            const response = await request(app)
                .post('/accounts/acc1/import-balances')
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.createdCount).toBe(1);
        });

        it('should perform a dry run without saving when dryRun=true', async () => {
            mockAccountData.retrieveSingle.mockResolvedValue({ id: 'acc1', name: 'Checking', category: 'Asset', group: 'Cash', type: 'Checking', balance: 0, userId: testUserId, isHidden: false, isManual: false, isRetirement: false, hideFromCashflow: false, createdAt: new Date(), updatedAt: new Date(), institutionId: '' } as any);

            const csvContent = 'Date,Balance,AccountName\n2026-06-06,100,Checking\n2026-06-07,150,Checking';

            const response = await request(app)
                .post('/accounts/acc1/import-balances?dryRun=true')
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.createdCount).toBe(2);
            expect(mockBalanceHistoryData.insertBulk).not.toHaveBeenCalled();
            expect(mockBalanceHistoryData.deleteRange).not.toHaveBeenCalled();
        });

        it('should fail validation when Date or Balance are missing', async () => {
            mockAccountData.retrieveSingle.mockResolvedValue({ id: 'acc1', name: 'Checking', category: 'Asset', group: 'Cash', type: 'Checking', balance: 0, userId: testUserId, isHidden: false, isManual: false, isRetirement: false, hideFromCashflow: false, createdAt: new Date(), updatedAt: new Date(), institutionId: '' } as any);

            const csvContent = 'Date,Balance,AccountName\n,100,Checking\n2026-06-06,,Checking';

            const response = await request(app)
                .post('/accounts/acc1/import-balances?dryRun=true')
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.failedRowMessages.length).toBe(2);
            expect(response.body.data.createdCount).toBe(0);
        });
    });

    describe('POST /accounts/:accountId/sync', () => {
        it('should return sync stub success', async () => {
            const response = await request(app)
                .post('/accounts/acc1/sync');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toContain('Sync account logic stub');
        });
    });
});
