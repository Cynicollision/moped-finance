import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { SortDirection } from '@shared/core/enum';
import { AccountCategory, AccountGroup, AccountType, CategoryClass, TransactionsSortKey } from '@shared/finance/enum';
import { AppLogger } from '@server-core/logger';
import { DatabaseClient } from '@server-core/db-client';
import { TestExpressUtil, TestDatabaseUtil } from '@server-core/utility/testing';
import { FinanceEntityFactory } from './../common';
import { FinanceAccountData } from './../accounts/account-data';
import { FinanceCategoryData } from './../categories/category-data';
import { FinanceCategoryGroupData } from './../categories/category-groups/category-group-data';
import { FinanceInstitutionData } from './../institutions/institution-data';
import { createTransactionRouter } from './transaction-routes';
import { FinanceTransactionData } from './transaction-data';

describe('Transaction Routes', () => {
    let app: express.Express;
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let transactionsData: FinanceTransactionData;
    let accountsData: FinanceAccountData;
    let categoriesData: FinanceCategoryData;
    let groupsData: FinanceCategoryGroupData;
    let institutionsData: FinanceInstitutionData;
    let mockLogger: jest.Mocked<AppLogger>;
    let testUserId: string;

    let testAccountId: string;
    let testCategoryId: string;

    beforeAll(async () => {
        const mockDb = await TestDatabaseUtil.createMockDatabase();
        dbClient = mockDb.dbClient;
        pglite = mockDb.pglite;

        const user = await TestDatabaseUtil.createTestUser(dbClient);
        testUserId = user.id;

        transactionsData = new FinanceTransactionData(dbClient);
        accountsData = new FinanceAccountData(dbClient);
        categoriesData = new FinanceCategoryData(dbClient);
        groupsData = new FinanceCategoryGroupData(dbClient);
        institutionsData = new FinanceInstitutionData(dbClient);
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createTransactionRouter(mockLogger, accountsData, categoriesData, transactionsData);
        app = TestExpressUtil.createTestApp(router, '/transactions', testUserId);
    });

    afterAll(async () => {
        if (pglite) {
            await pglite.close();
        }
    });

    beforeEach(async () => {
        await pglite.exec('TRUNCATE finance.institutions, finance.accounts, finance.category_groups, finance.categories, finance.transactions CASCADE;');

        const inst = await institutionsData.insert(FinanceEntityFactory.createInstitution(testUserId, { name: 'Bank' }));
        const account = await accountsData.create(FinanceEntityFactory.createAccount(testUserId, { institutionId: inst.id!, name: 'Checking', category: AccountCategory.Asset, group: AccountGroup.Cash, type: AccountType.Checking, isHidden: false, isManual: false, isRetirement: false, hideFromCashflow: false, balance: 0
        }));
        testAccountId = account.id!;

        const group = await groupsData.insert(FinanceEntityFactory.createCategoryGroup(testUserId, { class: CategoryClass.Expense, name: 'Food' }));
        const category = await categoriesData.insert(FinanceEntityFactory.createCategory(testUserId, { groupId: group.id!, name: 'Groceries', icon: 'apple', isActive: true
        }));
        testCategoryId = category.id!;
    });

    describe('GET /', () => {
        it('should return a list of transactions when successful with default options', async () => {
            const txn1 = await transactionsData.insert(FinanceEntityFactory.createTransaction(testUserId, { accountId: testAccountId, categoryId: testCategoryId, date: '2026-06-06', amount: 100, merchant: 'Test Merchant 1', isHidden: false, isSplit: false, originalStatement: '', notes: '', splitParentId: '' }));
            const txn2 = await transactionsData.insert(FinanceEntityFactory.createTransaction(testUserId, { accountId: testAccountId, categoryId: testCategoryId, date: '2026-06-07', amount: 200, merchant: 'Test Merchant 2', isHidden: false, isSplit: false, originalStatement: '', notes: '', splitParentId: '' }));

            const response = await request(app).get('/transactions');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(2);
            expect(response.body.data.map((t: any) => t.id)).toEqual(expect.arrayContaining([txn1.id, txn2.id]));
        });

        it('should parse and pass all search options correctly', async () => {
            const txn = await transactionsData.insert(FinanceEntityFactory.createTransaction(testUserId, { accountId: testAccountId, categoryId: testCategoryId, date: '2026-06-06', amount: 100, merchant: 'Test Merchant', isHidden: false, isSplit: false, originalStatement: '', notes: '', splitParentId: '' }));

            const filters = [
                { key: 'categoryId', value: testCategoryId },
                { key: 'merchant', value: 'Test' }
            ];

            const response = await request(app)
                .get('/transactions')
                .query({
                    sortKey: TransactionsSortKey.Amount,
                    sortDirection: SortDirection.Desc,
                    offset: '0',
                    limit: '25',
                    includeHidden: 'true',
                    minAmount: '50',
                    maxAmount: '500',
                    startDate: '2026-01-01',
                    endDate: '2026-12-31',
                    filters: JSON.stringify(filters)
                });

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(1);
            expect(response.body.data[0].id).toBe(txn.id);
        });
    });

    describe('POST /', () => {
        it('should create a new transaction when input is valid', async () => {
            const payload = {
                accountId: testAccountId,
                categoryId: testCategoryId,
                date: '2026-06-06',
                amount: 300.00,
                merchant: 'Groceries'
            };

            const response = await request(app)
                .post('/transactions')
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.merchant).toBe('Groceries');
            expect(response.body.data.amount).toBe(300);

            const dbTxn = await transactionsData.retrieveSingle(response.body.data.id);
            expect(dbTxn).not.toBeNull();
            expect(dbTxn?.merchant).toBe('Groceries');
        });

        it('should return 400 when schema validation fails (missing amount)', async () => {
            const payload = {
                accountId: testAccountId,
                categoryId: testCategoryId,
                date: '2026-06-06',
                merchant: 'Groceries'
            };

            const response = await request(app)
                .post('/transactions')
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('amount');
        });
    });

    describe('GET /merchants', () => {
        it('should return a list of merchants', async () => {
            await transactionsData.insert(FinanceEntityFactory.createTransaction(testUserId, { accountId: testAccountId, categoryId: testCategoryId, date: '2026-06-06', amount: 100, merchant: 'Amazon', isHidden: false, isSplit: false, originalStatement: '', notes: '', splitParentId: '' }));
            await transactionsData.insert(FinanceEntityFactory.createTransaction(testUserId, { accountId: testAccountId, categoryId: testCategoryId, date: '2026-06-06', amount: 100, merchant: 'Walmart', isHidden: false, isSplit: false, originalStatement: '', notes: '', splitParentId: '' }));

            const response = await request(app).get('/transactions/merchants');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(expect.arrayContaining(['Amazon', 'Walmart']));
        });
    });

    describe('GET /cashflow', () => {
        it('should return cashflow by category', async () => {
            await transactionsData.insert(FinanceEntityFactory.createTransaction(testUserId, { accountId: testAccountId, categoryId: testCategoryId, date: '2026-06-06', amount: 500, merchant: 'Test Merchant', isHidden: false, isSplit: false, originalStatement: '', notes: '', splitParentId: '' }));

            const response = await request(app).get('/transactions/cashflow?period=Monthly');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(1);
            expect(response.body.data[0].categoryId).toBe(testCategoryId);
            expect(response.body.data[0].amount).toBe(500);
        });
    });

    describe('GET /:id', () => {
        it('should return a single transaction when found', async () => {
            const txn = await transactionsData.insert(FinanceEntityFactory.createTransaction(testUserId, { accountId: testAccountId, categoryId: testCategoryId, date: '2026-06-06', amount: 100, merchant: 'Test Merchant', isHidden: false, isSplit: false, originalStatement: '', notes: '', splitParentId: '' }));

            const response = await request(app).get(`/transactions/${txn.id}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(txn.id);
        });

        it('should return 400 when transaction is not found', async () => {
            const response = await request(app).get('/transactions/missing-id');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
        });
    });

    describe('PUT /:id', () => {
        it('should update a transaction when valid and resource belongs to user', async () => {
            const txn = await transactionsData.insert(FinanceEntityFactory.createTransaction(testUserId, { accountId: testAccountId, categoryId: testCategoryId, date: '2026-06-06', amount: 100, merchant: 'Test Merchant', isHidden: false, isSplit: false, originalStatement: '', notes: '', splitParentId: '' }));

            const payload = {
                ...txn,
                amount: 120.00,
                merchant: 'Updated Merchant'
            };

            const response = await request(app)
                .put(`/transactions/${txn.id}`)
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.amount).toBe(120);
            expect(response.body.data.merchant).toBe('Updated Merchant');
        });

        it('should return 400 when update fails because resource does not exist or user lacks ownership', async () => {
            const response = await request(app)
                .put('/transactions/txn-1')
                .send({ amount: 100, merchant: 'Updated', date: '2026-06-06', accountId: testAccountId, categoryId: testCategoryId, isHidden: false, isSplit: false });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found or access denied');
        });
    });

    describe('DELETE /:id', () => {
        it('should delete a transaction when resource belongs to user', async () => {
            const txn = await transactionsData.insert(FinanceEntityFactory.createTransaction(testUserId, { accountId: testAccountId, categoryId: testCategoryId, date: '2026-06-06', amount: 100, merchant: 'Test Merchant', isHidden: false, isSplit: false, originalStatement: '', notes: '', splitParentId: '' }));

            const response = await request(app).delete(`/transactions/${txn.id}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);

            const dbTxn = await transactionsData.retrieveSingle(txn.id!);
            expect(dbTxn).toBeNull();
        });

        it('should return 400 when delete fails', async () => {
            const response = await request(app).delete('/transactions/missing');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found or access denied');
        });
    });

    describe('GET /export', () => {
        it('should return a CSV file of exported transactions', async () => {
            await transactionsData.insert(FinanceEntityFactory.createTransaction(testUserId, { accountId: testAccountId, categoryId: testCategoryId, date: '2026-06-06', amount: 100, merchant: 'Test Merchant', isHidden: false, isSplit: false, originalStatement: '', notes: '', splitParentId: '' }));

            const response = await request(app).get('/transactions/export');

            expect(response.status).toBe(200);
            expect(response.header['content-type']).toContain('text/csv');
            expect(response.text).toContain('Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden');
            expect(response.text).toContain('Test Merchant');
        });
    });

    describe('POST /import', () => {
        it('should process a CSV file and return import statistics', async () => {
            const csvContent = 'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden\n2026-06-06,Checking,Test,Groceries,100,,,false';

            const response = await request(app)
                .post('/transactions/import')
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.createdCount).toBe(1);
            expect(response.body.data.failedRowMessages.length).toBe(0);
        });

        it('should perform a dry run without saving when dryRun=true', async () => {
            const csvContent = 'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden\n2026-06-06,Checking,Test,Groceries,100,,,false';

            const response = await request(app)
                .post('/transactions/import?dryRun=true')
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.createdCount).toBe(1);

            const txns = await transactionsData.search(testUserId, { limit: 10, offset: 0, sortKey: TransactionsSortKey.Date, sortDirection: SortDirection.Desc, includeHidden: true });
            expect(txns.length).toBe(0);
        });

        it('should fail validation when Category is missing or invalid', async () => {
            const csvContent = 'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden\n2026-06-06,Checking,Test,InvalidCategory,100,,,false';

            const response = await request(app)
                .post('/transactions/import?dryRun=true')
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.failedRowMessages.length).toBe(1);
            expect(response.body.data.createdCount).toBe(0);
        });
    });
});
