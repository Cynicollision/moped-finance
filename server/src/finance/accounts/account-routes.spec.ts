import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { AccountCategory, AccountGroup, AccountType, TransactionsSortKey, ValueHistoryType } from '@shared/finance/enum';
import { SortDirection } from '@shared/core/enum';
import { Account, BalanceHistory, Institution, Transaction } from '@shared/finance/types';
import { IAppLogger } from '@server-core/logger';
import { DateTimeUtil } from '@server-core/utility';
import { TestExpressUtil, TestDatabaseUtil } from '@server-core/utility/testing';
import { FinanceEntityFactory } from './../common';
import { DatabaseClient } from '@server-core/db-client';
import { FinanceAccountData } from './account-data';
import { createAccountRouter } from './account-routes';
import { FinanceBalanceHistoryData } from './balance-history-data';
import { FinanceTransactionData } from './../transactions/transaction-data';
import { FinanceCategoryData } from './../categories/category-data';
import { FinanceInstitutionData } from './../institutions/institution-data';

describe('Account Routes', () => {
    let app: express.Express;
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let accountData: FinanceAccountData;
    let balanceHistoryData: FinanceBalanceHistoryData;
    let transactionsData: FinanceTransactionData;
    let categoriesData: FinanceCategoryData;
    let institutionData: FinanceInstitutionData;
    let mockLogger: jest.Mocked<IAppLogger>;
    let testUserId: string;
    let testInstitutionId: string;
    let testCategoryId: string;


    beforeAll(async () => {
        const mockDb = await TestDatabaseUtil.createMockDatabase();
        dbClient = mockDb.dbClient;
        pglite = mockDb.pglite;

        const user = await TestDatabaseUtil.createTestUser(dbClient);
        testUserId = user.id!;

        accountData = new FinanceAccountData(dbClient);
        balanceHistoryData = new FinanceBalanceHistoryData(dbClient);
        transactionsData = new FinanceTransactionData(dbClient);
        categoriesData = new FinanceCategoryData(dbClient);
        institutionData = new FinanceInstitutionData(dbClient);

        mockLogger = TestExpressUtil.createMockLogger();

        const router = createAccountRouter(mockLogger, accountData, balanceHistoryData, categoriesData, transactionsData);
        app = TestExpressUtil.createTestApp(router, '/accounts', testUserId);
    });

    afterAll(async () => {
        if (pglite) {
            await pglite.close();
        }
    });

    beforeEach(async () => {
        await pglite.exec('TRUNCATE finance.accounts, finance.balance_history, finance.transactions, finance.categories, finance.category_groups, finance.institutions CASCADE;');

        const inst = await institutionData.insert(FinanceEntityFactory.createInstitution(testUserId, { id: 'inst1', name: 'Test Bank' }));
        testInstitutionId = inst.id!;

        // Note: we need to use raw pglite exec because CategoryGroupData requires an import and we already have a long list.
        // It's simpler to just insert them directly via pglite.
        await pglite.exec(`
            INSERT INTO finance.category_groups (id, user_id, name, category_class) VALUES ('g1', '${testUserId}', 'Test Group', 'Expense');
            INSERT INTO finance.categories (id, user_id, group_id, name) VALUES ('cat1', '${testUserId}', 'g1', 'Test Category');
        `);
        testCategoryId = 'cat1';
    });

    describe('GET /accounts', () => {
        it('should return a list of accounts when successful', async () => {
            const acc1 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Checking',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));
            const acc2 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Savings',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Savings,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));

            const response = await request(app).get('/accounts');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(2);
            expect(response.body.data.map((a: any) => a.id)).toEqual(expect.arrayContaining([acc1.id, acc2.id]));
        });
    });

    describe('GET /accounts/total-value-history', () => {
        it('should return total value history with specific options', async () => {
            const acc1 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Checking',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));

            const balanceHistory: BalanceHistory[] = [{
                id: 'bh1',
                userId: testUserId,
                accountId: acc1.id!,
                balance: 2500.00,
                date: DateTimeUtil.now(),
                createdAt: DateTimeUtil.now(),
                updatedAt: DateTimeUtil.now()
            }];
            await balanceHistoryData.insertBulk(balanceHistory);

            const response = await request(app).get('/accounts/total-value-history?type=NetWorth&timeframe=PastThirtyDays');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBeGreaterThan(0);
            expect(response.body.data[0].amount).toBe(2500.00);
        });

        it('should use default timeframe and asOfDate when not provided', async () => {
            const response = await request(app).get('/accounts/total-value-history');
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /accounts/:accountId', () => {
        it('should return a single account when found', async () => {
            const acc1 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Checking',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));

            const response = await request(app).get(`/accounts/${acc1.id}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(acc1.id);
            expect(response.body.data.name).toBe('Checking');
        });

        it('should return 404 when account is not found', async () => {
            const response = await request(app).get('/accounts/missing');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found');
        });
    });

    describe('POST /accounts', () => {
        it('should create a new account', async () => {
            const payload = {
                name: 'New Account',
                institutionId: testInstitutionId,
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                isHidden: false,
                isManual: true,
                isRetirement: false,
                hideFromCashflow: false
            };

            const response = await request(app)
                .post('/accounts')
                .send(payload);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('New Account');
            expect(response.body.data.category).toBe(AccountCategory.Asset);

            const account = await accountData.retrieveSingle(response.body.data.id);
            expect(account).not.toBeNull();
            expect(account?.name).toBe('New Account');
        });

        it('should return 400 when schema validation fails (missing category)', async () => {
            const payload = {
                name: 'New Account',
                institutionId: testInstitutionId,
                group: AccountGroup.Cash
            };

            const response = await request(app)
                .post('/accounts')
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('category:');
        });
    });

    describe('PUT /accounts/:accountId', () => {
        it('should update an account when input is valid and resource belongs to user', async () => {
            const acc1 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Old Checking',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));

            const payload = {
                ...acc1,
                name: 'Updated Checking'
            };

            const response = await request(app)
                .put(`/accounts/${acc1.id}`)
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('Updated Checking');

            const updatedAccount = await accountData.retrieveSingle(acc1.id!);
            expect(updatedAccount?.name).toBe('Updated Checking');
        });

        it('should return 404 when update fails because resource does not exist', async () => {
            const payload = {
                name: 'Updated Checking',
                institutionId: testInstitutionId,
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                isHidden: false,
                isManual: true,
                isRetirement: false,
                hideFromCashflow: false
            };

            const response = await request(app)
                .put('/accounts/unowned-acc')
                .send(payload);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found');
        });
    });

    describe('DELETE /accounts/:accountId', () => {
        it('should delete an account when resource belongs to user', async () => {
            const acc1 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Checking',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));

            const response = await request(app).delete(`/accounts/${acc1.id}`);

            expect(response.status).toBe(204);

            const deletedAccount = await accountData.retrieveSingle(acc1.id!);
            expect(deletedAccount).toBeNull();
        });

        it('should return 404 when delete fails because resource does not exist', async () => {
            const response = await request(app).delete('/accounts/unowned-acc');

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found');
        });
    });

    describe('GET /accounts/:accountId/balance-history', () => {
        it('should return balance history for an account with default timeframe', async () => {
            const acc1 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Checking Account',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));

            const balanceHistory: BalanceHistory[] = [
                FinanceEntityFactory.createBalanceHistory(testUserId, { accountId: acc1.id!, balance: 500.00, date: DateTimeUtil.now() })
            ];
            await balanceHistoryData.insertBulk(balanceHistory);

            const response = await request(app).get(`/accounts/${acc1.id}/balance-history`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(1);
            expect(response.body.data[0].balance).toBe(500.00);
        });

        it('should parse timeframe and asOfDate query parameters correctly', async () => {
            const acc1 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Checking Account',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));

            const response = await request(app)
                .get(`/accounts/${acc1.id}/balance-history`)
                .query({
                    timeframe: 'PastThirtyDays',
                    asOfDate: '2026-06-01'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /accounts/:accountId/transactions', () => {
        it('should return transactions for an account with default options', async () => {
            const acc1 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Checking Account',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));

            await transactionsData.insert(FinanceEntityFactory.createTransaction(testUserId, {
                accountId: acc1.id, categoryId: testCategoryId,
                date: DateTimeUtil.nowToISOString(),
                amount: 50.00,
                merchant: 'Store',
                originalStatement: '',
                notes: '',
                isHidden: false,
                isSplit: false,
                splitParentId: ''
            }));

            const response = await request(app).get(`/accounts/${acc1.id}/transactions`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(1);
            expect(response.body.data[0].amount).toBe(50.00);
            expect(response.body.data[0].merchant).toBe('Store');
        });

        it('should pass search options to transaction search properly', async () => {
            const acc1 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Checking Account',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));

            const response = await request(app)
                .get(`/accounts/${acc1.id}/transactions`)
                .query({
                    sortKey: TransactionsSortKey.Date,
                    sortDirection: SortDirection.Asc,
                    limit: '10',
                    offset: '20',
                    includeHidden: 'true',
                    minAmount: '100'
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
        });
    });

    describe('GET /:accountId/export-balances', () => {
        it('should return a CSV file of exported balances', async () => {
            const acc1 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Checking',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));

            const balanceHistory: BalanceHistory[] = [
                FinanceEntityFactory.createBalanceHistory(testUserId, { accountId: acc1.id!, balance: 100.00, date: DateTimeUtil.now() })
            ];
            await balanceHistoryData.insertBulk(balanceHistory);

            const response = await request(app).get(`/accounts/${acc1.id}/export-balances`);

            expect(response.status).toBe(200);
            expect(response.header['content-type']).toContain('text/csv');
            expect(response.text).toContain('Date,AccountName,Balance');
            expect(response.text).toContain('100');
        });
    });

    describe('POST /:accountId/import-balances', () => {
        it('should process a CSV file and return import statistics', async () => {
            const acc1 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Checking',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));

            const csvContent = 'Date,Balance,AccountName\n2026-06-06,100,Checking';

            const response = await request(app)
                .post(`/accounts/${acc1.id}/import-balances`)
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.createdCount).toBe(1);

            const allHistory = await pglite.query('SELECT * FROM finance.balance_history');
            expect(allHistory.rows.length).toBeGreaterThan(0);
        });

        it('should perform a dry run without saving when dryRun=true', async () => {
            const acc1 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Checking',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));

            const csvContent = 'Date,Balance,AccountName\n2026-06-06,100,Checking\n2026-06-07,150,Checking';

            const response = await request(app)
                .post(`/accounts/${acc1.id}/import-balances?dryRun=true`)
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.createdCount).toBe(2);

            const allHistory = await pglite.query('SELECT * FROM finance.balance_history');
            expect(allHistory.rows.length).toBe(0);
        });

        it('should fail validation when Date or Balance are missing', async () => {
            const acc1 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Checking',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));

            const csvContent = 'Date,Balance,AccountName\n,100,Checking\n2026-06-06,,Checking';

            const response = await request(app)
                .post(`/accounts/${acc1.id}/import-balances?dryRun=true`)
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.failedRowMessages.length).toBe(2);
            expect(response.body.data.createdCount).toBe(0);
        });
    });

    describe('POST /accounts/:accountId/sync', () => {
        it('should return sync stub success', async () => {
            const acc1 = await accountData.insert(FinanceEntityFactory.createAccount(testUserId, {
                institutionId: testInstitutionId,
                name: 'Checking Account',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                balance: 1000.00,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromCashflow: false
            }));

            const response = await request(app)
                .post(`/accounts/${acc1.id}/sync`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toContain('Sync account logic stub');
        });
    });
});
