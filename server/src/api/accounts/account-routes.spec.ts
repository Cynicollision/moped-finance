import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { AccountCategory, AccountGroup, AccountType, TransactionsSortKey } from '@shared/finance/enum';
import { SortDirection } from '@shared/core/enum';
import { BalanceHistory } from '@shared/finance/types';
import { DatabaseClient, FinanceEntityFactory } from '@server/data';
import { IAppLogger } from '@server/logging';
import { DateTimeUtil } from '@server/utility';
import { TestExpressUtil, TestDatabaseUtil } from '@server/utility/testing';
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
        institutionData = new FinanceInstitutionData(dbClient);

        mockLogger = TestExpressUtil.createMockLogger();

        const router = createAccountRouter(mockLogger, accountData, balanceHistoryData, transactionsData);
        app = TestExpressUtil.createTestApp(router, '/accounts', testUserId);
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    beforeEach(async () => {
        await TestDatabaseUtil.clearFinanceData(pglite);

        const inst = await institutionData.insert(
            FinanceEntityFactory.createInstitution({ id: 'inst1', name: 'Test Bank' })
        );
        testInstitutionId = inst.id!;

        // Note: we need to use raw pglite exec because CategoryGroupData requires an import and we already have a long list.
        // It's simpler to just insert them directly via pglite.
        await pglite.exec(`
            INSERT INTO finance.category_groups (id, name, category_type) VALUES ('g1', 'Test Group', 'expense');
            INSERT INTO finance.categories (id, group_id, icon, name) VALUES ('cat1', 'g1', 'x', 'Test Category');
        `);
        testCategoryId = 'cat1';
    });

    function insertAccount(name: string = 'Checking') {
        return accountData.insert(
            FinanceEntityFactory.createAccount({
                institutionId: testInstitutionId,
                name,
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking
            })
        );
    }

    function importBalances(accountId: string, csv: string, query: string = ''): request.Test {
        return request(app)
            .post(`/accounts/${accountId}/import-balances${query}`)
            .attach('file', Buffer.from(csv), 'import.csv');
    }

    async function balancesFor(accountId: string): Promise<[string, number][]> {
        const result = await pglite.query<{ date: string; balance: string }>(
            `SELECT to_char(date, 'YYYY-MM-DD') AS date, balance FROM finance.balance_history WHERE account_id = $1 ORDER BY date`,
            [accountId]
        );
        return result.rows.map(r => [r.date, Number(r.balance)]);
    }

    describe('GET /accounts', () => {
        it('should return a list of accounts when successful', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );
            const acc2 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Savings',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Savings,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            const response = await request(app).get('/accounts');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map((a: any) => a.id)).toEqual(expect.arrayContaining([acc1.id, acc2.id]));
        });
    });

    describe('GET /accounts/total-value-history', () => {
        it('should return total value history with specific options', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            const balanceHistory: BalanceHistory[] = [
                {
                    id: 'bh1',
                    accountId: acc1.id!,
                    balance: 2500.0,
                    date: DateTimeUtil.today(),
                    createdAt: DateTimeUtil.now(),
                    updatedAt: DateTimeUtil.now()
                }
            ];
            await balanceHistoryData.insertBulk(balanceHistory);

            const response = await request(app).get(
                '/accounts/total-value-history?type=NetWorth&timeframe=PastThirtyDays'
            );

            expect(response.status).toBe(200);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0].amount).toBe(2500.0);
        });

        it('should default to the past thirty days up to today', async () => {
            DateTimeUtil.setClock(new Date('2026-06-01T16:00:00Z'));
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking
                })
            );
            await balanceHistoryData.insertBulk(
                ['2026-05-01', '2026-05-02', '2026-06-01', '2026-06-02'].map(date =>
                    FinanceEntityFactory.createBalanceHistory({ accountId: acc1.id, balance: 1, date })
                )
            );

            const response = await request(app).get('/accounts/total-value-history?type=NetWorth');

            expect(response.status).toBe(200);
            expect(response.body.map((v: { date: string }) => v.date)).toEqual(['2026-06-01', '2026-05-02']);
        });

        it('should return 400 when type is missing', async () => {
            const response = await request(app).get('/accounts/total-value-history');
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('type:');
        });

        it('should return 400 when timeframe is invalid', async () => {
            const response = await request(app).get(
                '/accounts/total-value-history?type=NetWorth&timeframe=InvalidValue'
            );
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('timeframe:');
        });
    });

    describe('GET /accounts/:accountId', () => {
        it('should return a single account when found', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            const response = await request(app).get(`/accounts/${acc1.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(acc1.id);
            expect(response.body.name).toBe('Checking');
        });

        it('should return 404 when account is not found', async () => {
            const response = await request(app).get('/accounts/missing');

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
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
                hideFromSpending: false
            };

            const response = await request(app).post('/accounts').send(payload);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('New Account');
            expect(response.body.category).toBe(AccountCategory.Asset);

            const account = await accountData.retrieveSingle(response.body.id);
            expect(account).not.toBeNull();
            expect(account?.name).toBe('New Account');
        });

        it('should return 400 when schema validation fails (missing category)', async () => {
            const payload = {
                name: 'New Account',
                institutionId: testInstitutionId,
                group: AccountGroup.Cash
            };

            const response = await request(app).post('/accounts').send(payload);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('category:');
        });

        it('should return 400 when group is not a known account group', async () => {
            const payload = {
                name: 'New Account',
                institutionId: testInstitutionId,
                category: AccountCategory.Asset,
                group: 'Crypto'
            };

            const response = await request(app).post('/accounts').send(payload);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('group:');
        });
    });

    describe('PUT /accounts/:accountId', () => {
        it('should update an account when input is valid', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Old Checking',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            const payload = {
                ...acc1,
                name: 'Updated Checking'
            };

            const response = await request(app).put(`/accounts/${acc1.id}`).send(payload);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Updated Checking');

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
                hideFromSpending: false
            };

            const response = await request(app).put('/accounts/missing-acc').send(payload);

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });
    });

    describe('DELETE /accounts/:accountId', () => {
        it('should delete an account', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            const response = await request(app).delete(`/accounts/${acc1.id}`);

            expect(response.status).toBe(204);

            const deletedAccount = await accountData.retrieveSingle(acc1.id!);
            expect(deletedAccount).toBeNull();
        });

        it('should return 404 when delete fails because resource does not exist', async () => {
            const response = await request(app).delete('/accounts/missing-acc');

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });
    });

    describe('GET /accounts/:accountId/balance-history', () => {
        it('should return balance history for an account with default timeframe', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking Account',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            const balanceHistory: BalanceHistory[] = [
                FinanceEntityFactory.createBalanceHistory({
                    accountId: acc1.id!,
                    balance: 500.0,
                    date: DateTimeUtil.today()
                })
            ];
            await balanceHistoryData.insertBulk(balanceHistory);

            const response = await request(app).get(`/accounts/${acc1.id}/balance-history`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].balance).toBe(500.0);
        });

        it('ACCT-2.4 should return the entries from 30 days before asOfDate through asOfDate, dated YYYY-MM-DD', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking Account',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );
            await balanceHistoryData.insertBulk(
                ['2026-05-01', '2026-05-02', '2026-06-01', '2026-06-02'].map(date =>
                    FinanceEntityFactory.createBalanceHistory({ accountId: acc1.id, balance: 1, date })
                )
            );

            const response = await request(app).get(`/accounts/${acc1.id}/balance-history`).query({
                timeframe: 'PastThirtyDays',
                asOfDate: '2026-06-01'
            });

            expect(response.status).toBe(200);
            expect(response.body.map((b: BalanceHistory) => b.date).sort()).toEqual(['2026-05-02', '2026-06-01']);
        });

        it('DASH-1.2 should total balances by date over the timeframe, dated YYYY-MM-DD', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking
                })
            );
            const acc2 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Savings',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Savings
                })
            );
            await balanceHistoryData.insertBulk([
                FinanceEntityFactory.createBalanceHistory({ accountId: acc1.id, balance: 100, date: '2026-05-31' }),
                FinanceEntityFactory.createBalanceHistory({ accountId: acc1.id, balance: 100, date: '2026-06-01' }),
                FinanceEntityFactory.createBalanceHistory({ accountId: acc2.id, balance: 50, date: '2026-06-01' }),
                FinanceEntityFactory.createBalanceHistory({ accountId: acc1.id, balance: 999, date: '2026-06-02' })
            ]);

            const response = await request(app).get(
                '/accounts/total-value-history?type=Assets&timeframe=PastThirtyDays&asOfDate=2026-06-01'
            );

            expect(response.body).toEqual([
                { date: '2026-06-01', amount: 150, type: 'Assets' },
                { date: '2026-05-31', amount: 100, type: 'Assets' }
            ]);
        });

        it('should return 400 when timeframe is invalid', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking Account',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            const response = await request(app)
                .get(`/accounts/${acc1.id}/balance-history`)
                .query({ timeframe: 'InvalidValue' });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('timeframe:');
        });
    });

    describe('GET /accounts/:accountId/transactions', () => {
        it('should return transactions for an account with default options', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking Account',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            await transactionsData.insert(
                FinanceEntityFactory.createTransaction({
                    accountId: acc1.id,
                    categoryId: testCategoryId,
                    date: DateTimeUtil.today(),
                    amount: 50.0,
                    merchant: 'Store',
                    originalStatement: '',
                    notes: '',
                    isHidden: false,
                    isSplit: false,
                    splitParentId: ''
                })
            );

            const response = await request(app).get(`/accounts/${acc1.id}/transactions`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].amount).toBe(50.0);
            expect(response.body[0].merchant).toBe('Store');
        });

        it('should pass search options to transaction search properly', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking Account',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            const response = await request(app).get(`/accounts/${acc1.id}/transactions`).query({
                sortKey: TransactionsSortKey.Date,
                sortDirection: SortDirection.Asc,
                limit: '10',
                offset: '20',
                includeHidden: 'true',
                minAmount: '100'
            });

            expect(response.status).toBe(200);
        });
    });

    describe('GET /:accountId/export-balances', () => {
        it('should return a CSV file of exported balances', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            const balanceHistory: BalanceHistory[] = [
                FinanceEntityFactory.createBalanceHistory({
                    accountId: acc1.id!,
                    balance: 100.0,
                    date: DateTimeUtil.today()
                })
            ];
            await balanceHistoryData.insertBulk(balanceHistory);

            const response = await request(app).get(`/accounts/${acc1.id}/export-balances`);

            expect(response.status).toBe(200);
            expect(response.header['content-type']).toContain('text/csv');
            expect(response.text).toContain('Date,AccountName,Balance');
            expect(response.text).toContain('100');
        });

        it('ACCT-3.1 should write dates as YYYY-MM-DD and balances with two decimals, newest first', async () => {
            const account = await insertAccount();
            await balanceHistoryData.insertBulk([
                FinanceEntityFactory.createBalanceHistory({
                    accountId: account.id,
                    balance: 100.5,
                    date: '2026-06-01'
                }),
                FinanceEntityFactory.createBalanceHistory({ accountId: account.id, balance: -3, date: '2026-06-02' })
            ]);

            const response = await request(app).get(`/accounts/${account.id}/export-balances`);

            expect(response.text).toBe(
                'Date,AccountName,Balance\n2026-06-02,Checking,-3.00\n2026-06-01,Checking,100.50\n'
            );
        });
    });

    describe('POST /:accountId/import-balances', () => {
        it('should process a CSV file and return import statistics', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            const csvContent = 'Date,Balance,AccountName\n2026-06-06,100,Checking';

            const response = await request(app)
                .post(`/accounts/${acc1.id}/import-balances`)
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(201);
            expect(response.body.createdCount).toBe(1);

            const allHistory = await pglite.query('SELECT * FROM finance.balance_history');
            expect(allHistory.rows.length).toBeGreaterThan(0);
        });

        it('should perform a dry run without saving when dryRun=true', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            const csvContent = 'Date,Balance,AccountName\n2026-06-06,100,Checking\n2026-06-07,150,Checking';

            const response = await request(app)
                .post(`/accounts/${acc1.id}/import-balances?dryRun=true`)
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(200);
            expect(response.body.createdCount).toBe(2);

            const allHistory = await pglite.query('SELECT * FROM finance.balance_history');
            expect(allHistory.rows.length).toBe(0);
        });

        it('should fail validation when Date or Balance are missing', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            const csvContent = 'Date,Balance,AccountName\n,100,Checking\n2026-06-06,,Checking';

            const response = await request(app)
                .post(`/accounts/${acc1.id}/import-balances?dryRun=true`)
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(200);
            expect(response.body.failedRowMessages.length).toBe(2);
            expect(response.body.createdCount).toBe(0);
        });

        it('should reject a second balance for the same date', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            const csvContent = 'Date,Balance,AccountName\n2026-06-06,100,Checking\n2026-06-06,200,Checking';

            const response = await request(app)
                .post(`/accounts/${acc1.id}/import-balances?dryRun=true`)
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(200);
            expect(response.body.failedRowMessages).toEqual(['Row 3: Duplicate date 2026-06-06']);
            expect(response.body.isValidToImport).toBe(false);
        });

        it('ACCT-3.4 should save nothing and return 400 with the row errors when a confirmed import has a bad row', async () => {
            const account = await insertAccount();

            const response = await importBalances(account.id, 'Date,Balance\n2026-06-06,100\n2026-06-07,lots');

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('INVALID_IMPORT');
            expect(response.body.details.failedRowMessages).toEqual(["Row 3: Balance 'lots' is not a number."]);
            expect(await balancesFor(account.id)).toEqual([]);
        });

        it('ACCT-3.4 should refuse a file that is missing a column or has no rows with a 400', async () => {
            const account = await insertAccount();

            const missingColumn = await importBalances(
                account.id,
                'Date,AccountName\n2026-06-06,Checking',
                '?dryRun=true'
            );
            const noRows = await importBalances(account.id, 'Date,Balance\n', '?dryRun=true');

            expect(missingColumn.status).toBe(400);
            expect(missingColumn.body.message).toBe('Missing required CSV headers: Balance');
            expect(noRows.status).toBe(400);
            expect(noRows.body.message).toBe('The CSV file has no data rows.');
        });

        it('ACCT-3.10 should report invalid dates and balances by row', async () => {
            const account = await insertAccount();

            const response = await importBalances(
                account.id,
                'Date,Balance\n2026-13-01,1\n6/6/2026,10000000000\n6/7/2026,"$1,000.25"',
                '?dryRun=true'
            );

            expect(response.status).toBe(200);
            expect(response.body.failedRowMessages).toEqual([
                "Row 2: Date '2026-13-01' is not a valid date.",
                "Row 3: Balance '10000000000' is too large."
            ]);
            expect(response.body.isValidToImport).toBe(false);
        });

        it("ACCT-3.5 should replace existing balances in the file's date range and keep the rest", async () => {
            const account = await insertAccount();
            await importBalances(account.id, 'Date,Balance\n2026-06-01,1\n2026-06-02,2\n2026-06-03,3\n2026-06-04,4');

            const response = await importBalances(account.id, 'Date,Balance\n2026-06-02,20\n2026-06-03,30');

            expect(response.status).toBe(201);
            expect(response.body).toEqual(
                expect.objectContaining({ startDate: '2026-06-02', endDate: '2026-06-03', createdCount: 2 })
            );
            expect(await balancesFor(account.id)).toEqual([
                ['2026-06-01', 1],
                ['2026-06-02', 20],
                ['2026-06-03', 30],
                ['2026-06-04', 4]
            ]);
        });

        it('ACCT-3.10 should keep the existing balances when the database rejects part of an import', async () => {
            const account = await insertAccount();
            await importBalances(account.id, 'Date,Balance\n2026-06-01,1\n2026-06-02,2');

            // A trigger stands in for any database failure after the old range has been deleted.
            await pglite.exec(`
                CREATE FUNCTION finance.reject_666() RETURNS trigger AS $$
                BEGIN
                    IF NEW.balance = 666 THEN RAISE EXCEPTION 'boom'; END IF;
                    RETURN NEW;
                END $$ LANGUAGE plpgsql;
                CREATE TRIGGER reject_666 BEFORE INSERT ON finance.balance_history FOR EACH ROW EXECUTE FUNCTION finance.reject_666();
            `);

            try {
                const response = await importBalances(account.id, 'Date,Balance\n2026-06-01,10\n2026-06-02,666');

                expect(response.status).toBe(500);
                expect(response.body).toEqual({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
                expect(await balancesFor(account.id)).toEqual([
                    ['2026-06-01', 1],
                    ['2026-06-02', 2]
                ]);
            } finally {
                await pglite.exec(
                    'DROP TRIGGER reject_666 ON finance.balance_history; DROP FUNCTION finance.reject_666();'
                );
            }
        });

        it('ACCT-3.1 should re-import its own export unchanged', async () => {
            const account = await insertAccount();
            await importBalances(account.id, 'Date,Balance\n2026-06-01,1.5\n2026-06-02,-2');
            const exported = await request(app).get(`/accounts/${account.id}/export-balances`);
            await pglite.exec('DELETE FROM finance.balance_history');

            const response = await importBalances(account.id, exported.text);

            expect(response.status).toBe(201);
            expect(await balancesFor(account.id)).toEqual([
                ['2026-06-01', 1.5],
                ['2026-06-02', -2]
            ]);
        });

        it('ACCT-3.2 should return 404 when importing into an account that does not exist', async () => {
            const response = await importBalances('missing', 'Date,Balance\n2026-06-06,1', '?dryRun=true');

            expect(response.status).toBe(404);
        });
    });

    describe('POST /accounts/:accountId/sync', () => {
        it('should return sync stub success', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking Account',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false
                })
            );

            const response = await request(app).post(`/accounts/${acc1.id}/sync`);

            expect(response.status).toBe(200);
            expect(response.body.message).toContain('Sync account logic stub');
        });
    });

    describe('field rules and partial updates', () => {
        it('ACCT-1.5 should change only the fields sent', async () => {
            const account = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Checking,
                    isHidden: true
                })
            );

            const response = await request(app).put(`/accounts/${account.id}`).send({ name: 'Renamed' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual(
                expect.objectContaining({ name: 'Renamed', type: AccountType.Checking, isHidden: true })
            );
        });

        it('ACCT-1.5 should clear the type when it is sent as null', async () => {
            const account = await insertAccount();

            const response = await request(app).put(`/accounts/${account.id}`).send({ type: null });

            expect(response.status).toBe(200);
            expect(response.body.type).toBeNull();
        });

        it('APP-5.5 should reject an account whose institution does not exist', async () => {
            const payload = {
                institutionId: 'missing',
                name: 'X',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash
            };

            const response = await request(app).post('/accounts').send(payload);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ code: 'INVALID_REFERENCE', message: 'Institution not found.' });
        });

        it('APP-5.7 should reject an asOfDate that is not a date', async () => {
            const account = await insertAccount();

            const history = await request(app).get(`/accounts/${account.id}/balance-history?asOfDate=nope`);
            const total = await request(app).get('/accounts/total-value-history?type=NetWorth&asOfDate=nope');

            expect(history.status).toBe(400);
            expect(history.body.message).toContain('asOfDate:');
            expect(total.status).toBe(400);
            expect(total.body.message).toContain('asOfDate:');
        });

        it('ACCT-2.7 should return 404 for the transactions of an account that does not exist', async () => {
            const response = await request(app).get('/accounts/missing/transactions');

            expect(response.status).toBe(404);
        });
    });
});
