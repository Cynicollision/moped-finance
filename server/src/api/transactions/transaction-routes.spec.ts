import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { SortDirection } from '@shared/core/enum';
import {
    AccountType,
    BalanceEntrySource,
    CategoryType,
    TransactionsFilterKey,
    TransactionsSortKey
} from '@shared/finance/enum';
import { Transaction } from '@shared/finance/types';
import { Uncategorized } from '@shared/finance/util';
import { IAppLogger } from '@server/logging';
import { DatabaseClient, EntityFactory } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { TestExpressUtil, TestDatabaseUtil } from '@server/utility/testing';
import { AccountData, BalanceHistoryData } from './../accounts';
import { CategoryData, CategoryGroupData } from './../categories';
import { InstitutionData } from './../institutions';
import { createTransactionRouter } from './transaction-routes';
import { TransactionData } from './transaction-data';

describe('Transaction Routes', () => {
    let app: express.Express;
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let transactionsData: TransactionData;
    let accountsData: AccountData;
    let categoriesData: CategoryData;
    let groupsData: CategoryGroupData;
    let institutionsData: InstitutionData;
    let mockLogger: jest.Mocked<IAppLogger>;
    let testUserId: string;

    let testInstitutionId: string;
    let testAccountId: string;
    let testCategoryId: string;

    beforeAll(async () => {
        const mockDb = await TestDatabaseUtil.createMockDatabase();
        dbClient = mockDb.dbClient;
        pglite = mockDb.pglite;

        const user = await TestDatabaseUtil.createTestUser(dbClient);
        testUserId = user.id;

        transactionsData = new TransactionData(dbClient);
        accountsData = new AccountData(dbClient);
        categoriesData = new CategoryData(dbClient);
        groupsData = new CategoryGroupData(dbClient);
        institutionsData = new InstitutionData(dbClient);
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createTransactionRouter(mockLogger, accountsData, categoriesData, transactionsData);
        app = TestExpressUtil.createTestApp(router, '/transactions', testUserId);
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    beforeEach(async () => {
        await TestDatabaseUtil.clearFinanceData(pglite);

        const inst = await institutionsData.insert(EntityFactory.createInstitution({ name: 'Bank' }));
        testInstitutionId = inst.id!;
        const account = await accountsData.insert(
            EntityFactory.createAccount({
                institutionId: inst.id!,
                name: 'Checking',
                type: AccountType.Checking,
                isHidden: false,
                isManual: false,
                balance: 0
            })
        );
        testAccountId = account.id!;

        const group = await groupsData.insert(
            EntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Food' })
        );
        const category = await categoriesData.insert(
            EntityFactory.createCategory({
                groupId: group.id!,
                name: 'Groceries',
                icon: '🍎',
                isActive: true
            })
        );
        testCategoryId = category.id!;
    });

    const csvHeader = 'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden\n';

    function insertTransaction(fields: Partial<Transaction> = {}): Promise<Transaction> {
        return transactionsData.insert(
            EntityFactory.createTransaction({
                accountId: testAccountId,
                categoryId: testCategoryId,
                date: '2026-06-06',
                amount: 100,
                merchant: 'Test Merchant',
                isHidden: false,
                originalStatement: '',
                notes: '',
                ...fields
            })
        );
    }

    // A second account alongside Checking, with the given flags.
    async function insertAccount(flags: { isHidden?: boolean }): Promise<string> {
        const account = await accountsData.insert(
            EntityFactory.createAccount({
                institutionId: testInstitutionId,
                name: 'Savings',
                type: AccountType.Savings,
                isHidden: false,
                isManual: false,
                balance: 0,
                ...flags
            })
        );
        return account.id!;
    }

    function importCsv(rows: string, query = ''): request.Test {
        return request(app)
            .post(`/transactions/import${query}`)
            .attach('file', Buffer.from(csvHeader + rows), 'import.csv');
    }

    async function countTransactions(): Promise<number> {
        const result = await pglite.query<{ count: number }>('SELECT count(*)::int AS count FROM finance.transactions');
        return result.rows[0].count;
    }

    describe('GET /', () => {
        it('TXN-1.2 TXN-1.8 should list transactions newest first, leaving out hidden ones, by default', async () => {
            const txn1 = await transactionsData.insert(
                EntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Test Merchant 1',
                    isHidden: false,
                    originalStatement: '',
                    notes: ''
                })
            );
            const txn2 = await transactionsData.insert(
                EntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-07',
                    amount: 200,
                    merchant: 'Test Merchant 2',
                    isHidden: false,
                    originalStatement: '',
                    notes: ''
                })
            );

            await insertTransaction({ date: '2026-06-08', isHidden: true });

            const response = await request(app).get('/transactions');

            expect(response.status).toBe(200);
            expect(response.body.map((t: any) => t.id)).toEqual([txn2.id, txn1.id]);
        });

        it('TXN-1.5 should apply every filter together', async () => {
            const txn = await transactionsData.insert(
                EntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Test Merchant',
                    isHidden: false,
                    originalStatement: '',
                    notes: ''
                })
            );

            // Each of these fails just one of the filters below.
            await insertTransaction({ merchant: 'Other Merchant' });
            await insertTransaction({ amount: 1000 });
            await insertTransaction({ date: '2025-12-31' });
            await insertTransaction({ categoryId: '' });

            const filters = [
                { key: TransactionsFilterKey.Category, value: testCategoryId },
                { key: TransactionsFilterKey.Merchant, value: 'Test' }
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
            expect(response.body.length).toBe(1);
            expect(response.body[0].id).toBe(txn.id);
        });

        it('TXN-1.14 should compare the amount filters with the size of the amount, ignoring its sign', async () => {
            const purchase = await insertTransaction({ amount: -150 });
            const deposit = await insertTransaction({ amount: 120 });
            await insertTransaction({ amount: -20 });
            await insertTransaction({ amount: 900 });

            const response = await request(app).get('/transactions').query({
                minAmount: '100',
                maxAmount: '200',
                sortKey: TransactionsSortKey.Amount,
                sortDirection: SortDirection.Asc
            });

            expect(response.status).toBe(200);
            expect(response.body.map((t: Transaction) => t.id)).toEqual([purchase.id, deposit.id]);
        });

        it('TXN-1.14 should narrow by direction, so "Min Amount 100, Money out" finds purchases of $100 or more', async () => {
            const purchase = await insertTransaction({ amount: -150 });
            const deposit = await insertTransaction({ amount: 150 });
            await insertTransaction({ amount: -50 });

            const out = await request(app).get('/transactions').query({ minAmount: '100', direction: 'out' });
            const moneyIn = await request(app).get('/transactions').query({ direction: 'in' });

            expect(out.body.map((t: Transaction) => t.id)).toEqual([purchase.id]);
            expect(moneyIn.body.map((t: Transaction) => t.id)).toEqual([deposit.id]);
        });

        it('APP-5.7 TXN-1.14 should refuse a negative amount filter or an unknown direction', async () => {
            const negative = await request(app).get('/transactions').query({ minAmount: '-100' });
            const direction = await request(app).get('/transactions').query({ direction: 'sideways' });

            expect(negative.status).toBe(400);
            expect(negative.body.message).toContain('minAmount');
            expect(direction.status).toBe(400);
            expect(direction.body.message).toContain('direction');
        });

        it('TXN-1.12 should leave out transactions in hidden accounts unless filtered to that account', async () => {
            const hiddenAccountId = await insertAccount({ isHidden: true });
            const shown = await insertTransaction();
            const inHidden = await insertTransaction({ accountId: hiddenAccountId });

            const all = await request(app).get('/transactions');
            const filtered = await request(app)
                .get('/transactions')
                .query({ filters: JSON.stringify([{ key: TransactionsFilterKey.AccountId, value: hiddenAccountId }]) });

            expect(all.body.map((t: Transaction) => t.id)).toEqual([shown.id]);
            expect(filtered.body.map((t: Transaction) => t.id)).toEqual([inHidden.id]);
        });
    });

    describe('POST /', () => {
        it('TXN-2.1 should create a new transaction when input is valid', async () => {
            const payload = {
                accountId: testAccountId,
                categoryId: testCategoryId,
                date: '2026-06-06',
                amount: 300.0,
                merchant: 'Groceries'
            };

            const response = await request(app).post('/transactions').send(payload);

            expect(response.status).toBe(201);
            expect(response.body.merchant).toBe('Groceries');
            expect(response.body.amount).toBe(300);

            const dbTxn = await transactionsData.retrieveSingle(response.body.id);
            expect(dbTxn).not.toBeNull();
            expect(dbTxn?.merchant).toBe('Groceries');
        });

        it('APP-8.1 should refuse a date after today, allowing a day for time zones', async () => {
            DateTimeUtil.setClock(new Date('2026-05-17T12:00:00Z'));
            const payload = { accountId: testAccountId, amount: -5, merchant: 'Coffee' };

            const tomorrow = await request(app)
                .post('/transactions')
                .send({ ...payload, date: '2026-05-18' });
            const later = await request(app)
                .post('/transactions')
                .send({ ...payload, date: '2026-05-19' });

            expect(tomorrow.status).toBe(201);
            expect(later.status).toBe(400);
            expect(later.body.message).toContain("date: Can't be after today");
        });

        it('APP-5.7 should return 400 when schema validation fails (missing amount)', async () => {
            const payload = {
                accountId: testAccountId,
                categoryId: testCategoryId,
                date: '2026-06-06',
                merchant: 'Groceries'
            };

            const response = await request(app).post('/transactions').send(payload);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('amount');
        });
    });

    describe('GET /merchants', () => {
        it('TXN-1.6 should return the merchants used before', async () => {
            await transactionsData.insert(
                EntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Amazon',
                    isHidden: false,
                    originalStatement: '',
                    notes: ''
                })
            );
            await transactionsData.insert(
                EntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Walmart',
                    isHidden: false,
                    originalStatement: '',
                    notes: ''
                })
            );

            const response = await request(app).get('/transactions/merchants');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(expect.arrayContaining(['Amazon', 'Walmart']));
        });
    });

    describe('GET /spending', () => {
        // A category in a new group of the given type.
        async function insertCategory(type: CategoryType, name: string): Promise<string> {
            const group = await groupsData.insert(EntityFactory.createCategoryGroup({ type, name }));
            const category = await categoriesData.insert(
                EntityFactory.createCategory({ groupId: group.id!, name, icon: '', isActive: true })
            );
            return category.id!;
        }

        function getJune(): request.Test {
            return request(app).get('/transactions/spending?period=Monthly&asOfDate=2026-06-15');
        }

        it('CASH-1.2 should return spending by category', async () => {
            await insertTransaction({ amount: -500 });

            const response = await getJune();

            expect(response.status).toBe(200);
            expect(response.body).toEqual([{ categoryId: testCategoryId, type: CategoryType.Expense, amount: 500 }]);
        });

        it('APP-5.6 CASH-1.2 should count the first and last days of the month and nothing from the next, west of UTC', async () => {
            // Tests run with TZ=America/New_York (jest.config.js).
            await insertTransaction({ date: '2026-03-31', amount: -1 });
            await insertTransaction({ date: '2026-04-01', amount: -10 });
            await insertTransaction({ date: '2026-04-30', amount: -100 });
            await insertTransaction({ date: '2026-05-01', amount: -1000 });

            const response = await request(app).get('/transactions/spending?period=Monthly&asOfDate=2026-04-15');

            expect(response.body).toEqual([{ categoryId: testCategoryId, type: CategoryType.Expense, amount: 110 }]);
        });

        it('CASH-1.2 should leave out hidden transactions', async () => {
            await insertTransaction({ amount: -10 });
            await insertTransaction({ amount: -100, isHidden: true });

            expect((await getJune()).body).toEqual([
                { categoryId: testCategoryId, type: CategoryType.Expense, amount: 10 }
            ]);
        });

        it('CASH-1.2 should leave out hidden accounts', async () => {
            const hiddenAccountId = await insertAccount({ isHidden: true });
            await insertTransaction({ amount: -10 });
            await insertTransaction({ accountId: hiddenAccountId, amount: -100 });

            expect((await getJune()).body).toEqual([
                { categoryId: testCategoryId, type: CategoryType.Expense, amount: 10 }
            ]);
        });

        it('CASH-1.3 should count income categories as income and leave out transfer categories', async () => {
            const paycheckId = await insertCategory(CategoryType.Income, 'Paycheck');
            const cardPaymentId = await insertCategory(CategoryType.Transfer, 'Card Payment');
            await insertTransaction({ categoryId: paycheckId, amount: 4000 });
            await insertTransaction({ categoryId: paycheckId, amount: -150 });
            await insertTransaction({ categoryId: cardPaymentId, amount: -900 });
            await insertTransaction({ categoryId: cardPaymentId, amount: 900 });

            expect((await getJune()).body).toEqual([
                { categoryId: paycheckId, type: CategoryType.Income, amount: 3850 }
            ]);
        });

        it('CASH-1.9 should net refunds against an expense category, going negative when they exceed its spending', async () => {
            await insertTransaction({ amount: -30.1 });
            await insertTransaction({ amount: 50.2 });

            expect((await getJune()).body).toEqual([
                { categoryId: testCategoryId, type: CategoryType.Expense, amount: -20.1 }
            ]);
        });

        it('CASH-1.3 should count uncategorized money in as income and money out as expenses', async () => {
            await insertTransaction({ categoryId: '', amount: 25 });
            await insertTransaction({ categoryId: '', amount: 15 });
            await insertTransaction({ categoryId: '', amount: -60 });
            await insertTransaction({ amount: 5 });
            await insertTransaction({ amount: -30 });

            const response = await getJune();

            expect(response.body).toHaveLength(3);
            expect(response.body).toEqual(
                expect.arrayContaining([
                    { categoryId: testCategoryId, type: CategoryType.Expense, amount: 25 },
                    { categoryId: '', type: CategoryType.Income, amount: 40 },
                    { categoryId: '', type: CategoryType.Expense, amount: 60 }
                ])
            );
        });

        it('APP-5.7 should reject an asOfDate that is a timestamp rather than a date', async () => {
            const response = await request(app).get(
                '/transactions/spending?period=Monthly&asOfDate=2026-04-15T00:00:00.000Z'
            );

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('asOfDate: Expected a date as YYYY-MM-DD');
        });
    });

    describe('GET /spending/average', () => {
        function getAverage(asOfDate = '2026-06-15'): request.Test {
            return request(app).get(`/transactions/spending/average?asOfDate=${asOfDate}`);
        }

        it('BUD-1.8 CASH-1.12 should average the 12 full months before the current one', async () => {
            await insertTransaction({ date: '2025-05-31', amount: -1 });
            await insertTransaction({ date: '2025-06-01', amount: -120 });
            await insertTransaction({ date: '2026-05-31', amount: -240 });
            await insertTransaction({ date: '2026-06-01', amount: -1000 });

            const response = await getAverage();

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                startDate: '2025-06-01',
                endDate: '2026-05-31',
                months: 12,
                totals: [{ categoryId: testCategoryId, type: CategoryType.Expense, amount: 30 }],
                transfers: []
            });
        });

        it('BUD-1.8 CASH-1.12 should average over fewer months when the oldest transaction is more recent', async () => {
            await insertTransaction({ date: '2026-03-20', amount: -100 });

            const response = await getAverage();

            expect(response.body).toEqual({
                startDate: '2026-03-01',
                endDate: '2026-05-31',
                months: 3,
                totals: [{ categoryId: testCategoryId, type: CategoryType.Expense, amount: 33.33 }],
                transfers: []
            });
        });

        it('BUD-1.8 CASH-1.12 should have no months when nothing is older than the current month', async () => {
            await insertTransaction({ date: '2026-06-01', amount: -100 });

            const response = await getAverage();

            expect(response.body).toEqual({
                startDate: '2026-06-01',
                endDate: '2026-05-31',
                months: 0,
                totals: [],
                transfers: []
            });
        });

        it('CASH-1.12 should leave hidden transactions out of the window and the averages', async () => {
            await insertTransaction({ date: '2026-01-10', amount: -1000, isHidden: true });
            await insertTransaction({ date: '2026-05-10', amount: -40 });

            const response = await getAverage();

            expect(response.body.months).toBe(1);
            expect(response.body.totals).toEqual([
                { categoryId: testCategoryId, type: CategoryType.Expense, amount: 40 }
            ]);
        });

        it('BUD-1.8 should average a transfer category by its money out only', async () => {
            const group = await groupsData.insert(
                EntityFactory.createCategoryGroup({ type: CategoryType.Transfer, name: 'Transfers' })
            );
            const savings = await categoriesData.insert(
                EntityFactory.createCategory({ groupId: group.id!, name: 'Savings', icon: '', isActive: true })
            );
            const savingsAccountId = await insertAccount({});
            for (const date of ['2026-04-01', '2026-05-01']) {
                await insertTransaction({ date, categoryId: savings.id!, amount: -500 });
                await insertTransaction({ date, categoryId: savings.id!, accountId: savingsAccountId, amount: 500 });
            }

            const response = await getAverage();

            expect(response.body.months).toBe(2);
            expect(response.body.totals).toEqual([]);
            expect(response.body.transfers).toEqual([{ categoryId: savings.id, amount: 500 }]);
        });
    });

    describe('GET /:id', () => {
        it('TXN-2.2 should return a single transaction when found', async () => {
            const txn = await transactionsData.insert(
                EntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Test Merchant',
                    isHidden: false,
                    originalStatement: '',
                    notes: ''
                })
            );

            const response = await request(app).get(`/transactions/${txn.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(txn.id);
        });

        it('TXN-2.2 should return 404 when transaction is not found', async () => {
            const response = await request(app).get('/transactions/missing-id');

            expect(response.status).toBe(404);
        });
    });

    describe('PUT /:id', () => {
        it('TXN-2.3 should update a transaction when valid', async () => {
            const txn = await transactionsData.insert(
                EntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Test Merchant',
                    isHidden: false,
                    originalStatement: '',
                    notes: ''
                })
            );

            const payload = {
                ...txn,
                amount: 120.0,
                merchant: 'Updated Merchant'
            };

            const response = await request(app).put(`/transactions/${txn.id}`).send(payload);

            expect(response.status).toBe(200);
            expect(response.body.amount).toBe(120);
            expect(response.body.merchant).toBe('Updated Merchant');
        });

        it('TXN-2.3 should return 404 when update target does not exist', async () => {
            const response = await request(app).put('/transactions/txn-1').send({
                amount: 100,
                merchant: 'Updated',
                date: '2026-06-06',
                accountId: testAccountId,
                categoryId: testCategoryId,
                isHidden: false
            });

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });
    });

    describe('DELETE /:id', () => {
        it('TXN-2.4 should delete a transaction', async () => {
            const txn = await transactionsData.insert(
                EntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Test Merchant',
                    isHidden: false,
                    originalStatement: '',
                    notes: ''
                })
            );

            const response = await request(app).delete(`/transactions/${txn.id}`);

            expect(response.status).toBe(204);

            const dbTxn = await transactionsData.retrieveSingle(txn.id!);
            expect(dbTxn).toBeNull();
        });

        it('TXN-2.4 should return 404 when delete target does not exist', async () => {
            const response = await request(app).delete('/transactions/missing');

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });
    });

    describe('GET /export', () => {
        it('TXN-3.1 should return a CSV file of exported transactions', async () => {
            await transactionsData.insert(
                EntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Test Merchant',
                    isHidden: false,
                    originalStatement: '',
                    notes: ''
                })
            );

            const response = await request(app).get('/transactions/export');

            expect(response.status).toBe(200);
            expect(response.header['content-type']).toContain('text/csv');
            expect(response.header['content-disposition']).toMatch(
                /filename="?Transactions_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv"?$/
            );
            expect(response.text).toContain(
                'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden'
            );
            expect(response.text).toContain('Test Merchant');
        });

        it('TXN-3.1 should write the Id, dates as YYYY-MM-DD and amounts with two decimals', async () => {
            const transaction = await insertTransaction({ date: '2026-06-06', amount: -12.5, merchant: 'Shop' });

            const response = await request(app).get('/transactions/export');

            expect(response.text).toBe(
                `Id,${csvHeader}${transaction.id},2026-06-06,Checking,Shop,Groceries,-12.50,,,false\n`
            );
        });

        it('TXN-3.1 should have only the header row when there are no transactions', async () => {
            const response = await request(app).get('/transactions/export');

            expect(response.text).toBe(`Id,${csvHeader}`);
        });

        it('TXN-3.1 should return 404 when exporting an account that does not exist', async () => {
            const response = await request(app).get('/transactions/export?accountId=missing');

            expect(response.status).toBe(404);
        });
    });

    describe('POST /import', () => {
        it('TXN-3.3 should process a CSV file and return import statistics', async () => {
            const csvContent =
                'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden\n2026-06-06,Checking,Test,Groceries,100,,,false';

            const response = await request(app)
                .post('/transactions/import')
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(201);
            expect(response.body.createdCount).toBe(1);
            expect(response.body.failedRowMessages.length).toBe(0);
        });

        it('TXN-3.3 should perform a dry run without saving when dryRun=true', async () => {
            const csvContent =
                'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden\n2026-06-06,Checking,Test,Groceries,100,,,false';

            const response = await request(app)
                .post('/transactions/import?dryRun=true')
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(200);
            expect(response.body.createdCount).toBe(1);

            const txns = await transactionsData.search({
                limit: 10,
                offset: 0,
                sortKey: TransactionsSortKey.Date,
                sortDirection: SortDirection.Desc,
                includeHidden: true
            });
            expect(txns.length).toBe(0);
        });

        it('TXN-3.4 should import a blank, Uncategorized or unknown category as Uncategorized, reporting the unknown names', async () => {
            const rows = [
                '2026-06-06,Checking,Blank,,1,,,false',
                '2026-06-06,Checking,Named,uncategorized,2,,,false',
                '2026-06-06,Checking,Typo,Groceriez,3,,,false',
                '2026-06-06,Checking,Known,Groceries,4,,,false',
                '2026-06-06,Checking,Typo again,groceriez,5,,,false',
                '2026-06-06,Checking,Other,Mystery,6,,,false'
            ].join('\n');

            const dryRun = await importCsv(rows, '?dryRun=true');

            expect(dryRun.status).toBe(200);
            expect(dryRun.body).toEqual(
                expect.objectContaining({
                    isValidToImport: true,
                    createdCount: 6,
                    uncategorizedCount: 5,
                    unmatchedCategories: [
                        { name: 'Groceriez', rowNumbers: [4, 6] },
                        { name: 'Mystery', rowNumbers: [7] }
                    ]
                })
            );

            const response = await importCsv(rows);

            expect(response.status).toBe(201);
            const saved = await transactionsData.search({ limit: 10, includeHidden: true });
            expect(
                saved
                    .filter(t => !t.categoryId)
                    .map(t => t.merchant)
                    .sort()
            ).toEqual(['Blank', 'Named', 'Other', 'Typo', 'Typo again']);
        });

        it('TXN-3.9 should save nothing and return 400 with the row errors when a confirmed import has a bad row', async () => {
            const response = await importCsv(
                '2026-06-06,Checking,Good,Groceries,100,,,false\n2026-06-07,Checking,Bad,Groceries,abc,,,false'
            );

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('INVALID_IMPORT');
            expect(response.body.message).toBe('Nothing was imported. Found errors in 1 of 2 rows.');
            expect(response.body.details.failedRowMessages).toEqual(["Row 3: Amount 'abc' is not a number."]);
            expect(await countTransactions()).toBe(0);
        });

        it('TXN-3.9 should save none of the rows when the database rejects one of them', async () => {
            // A trigger stands in for any database failure partway through the bulk insert.
            await pglite.exec(`
                CREATE FUNCTION finance.reject_boom() RETURNS trigger AS $$
                BEGIN
                    IF NEW.merchant = 'Boom' THEN RAISE EXCEPTION 'boom'; END IF;
                    RETURN NEW;
                END $$ LANGUAGE plpgsql;
                CREATE TRIGGER reject_boom BEFORE INSERT ON finance.transactions FOR EACH ROW EXECUTE FUNCTION finance.reject_boom();
            `);

            try {
                const response = await importCsv(
                    '2026-06-06,Checking,One,Groceries,1,,,false\n2026-06-07,Checking,Two,Groceries,2,,,false\n2026-06-08,Checking,Boom,Groceries,3,,,false'
                );

                expect(response.status).toBe(500);
                expect(response.body).toEqual({ code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' });
                expect(await countTransactions()).toBe(0);
            } finally {
                await pglite.exec(
                    'DROP TRIGGER reject_boom ON finance.transactions; DROP FUNCTION finance.reject_boom();'
                );
            }
        });

        it('TXN-3.10 should report every problem in a row as one message', async () => {
            const response = await importCsv('2026-02-30,Nope,Test,,1.234,,,maybe', '?dryRun=true');

            expect(response.status).toBe(200);
            expect(response.body.isValidToImport).toBe(false);
            expect(response.body.failedRowMessages).toEqual([
                "Row 2: Account name 'Nope' not found. Date '2026-02-30' is not a valid date. Amount '1.234' has more than two decimal places. IsHidden must be true, false or blank."
            ]);
        });

        it.each([
            ['', 'Date is required.'],
            ['17/05/2026', "Date '17/05/2026' is not a valid date."],
            ['2026-5-7', "Date '2026-5-7' is not a date; use YYYY-MM-DD or M/D/YYYY."],
            ['yesterday', "Date 'yesterday' is not a date; use YYYY-MM-DD or M/D/YYYY."]
        ])('TXN-3.10 should reject the date %p', async (date, message) => {
            const response = await importCsv(`${date},Checking,Test,Groceries,1,,,false`, '?dryRun=true');

            expect(response.body.failedRowMessages).toEqual([`Row 2: ${message}`]);
        });

        it('APP-8.1 should reject a date after today, allowing a day for time zones', async () => {
            DateTimeUtil.setClock(new Date('2026-05-17T12:00:00Z'));

            const response = await importCsv(
                '2026-05-18,Checking,Test,Groceries,1,,,false\n2026-05-19,Checking,Test,Groceries,1,,,false',
                '?dryRun=true'
            );

            expect(response.body.failedRowMessages).toEqual(['Row 3: Date 2026-05-19 is after today.']);
        });

        it.each([
            ['', 'Amount is required.'],
            ['12abc', "Amount '12abc' is not a number."],
            ['10000000000', "Amount '10000000000' is too large."]
        ])('TXN-3.10 should reject the amount %p', async (amount, message) => {
            const response = await importCsv(`2026-06-06,Checking,Test,Groceries,${amount},,,false`, '?dryRun=true');

            expect(response.body.failedRowMessages).toEqual([`Row 2: ${message}`]);
        });

        it('TXN-3.10 should reject a merchant longer than 255 characters', async () => {
            const response = await importCsv(
                `2026-06-06,Checking,${'m'.repeat(256)},Groceries,1,,,false`,
                '?dryRun=true'
            );

            expect(response.body.failedRowMessages).toEqual(['Row 2: Merchant is longer than 255 characters.']);
        });

        it('TXN-3.10 should report a row with the wrong number of columns', async () => {
            const response = await importCsv('2026-06-06,Checking,Test,Groceries,1,,', '?dryRun=true');

            expect(response.body.failedRowMessages).toEqual(['Row 2: Expected 8 columns.']);
        });

        it('TXN-3.10 should accept M/D/YYYY dates, ISO timestamps, and amounts with $ and thousands separators', async () => {
            const response = await importCsv(
                '5/7/2026,Checking,A,Groceries,"-$1,234.56",,,TRUE\n2026-05-08T00:00:00.000Z,checking,B,groceries,+12,,,'
            );

            expect(response.status).toBe(201);
            expect(response.body.createdCount).toBe(2);

            const saved = await transactionsData.search({
                sortKey: TransactionsSortKey.Date,
                sortDirection: SortDirection.Asc,
                includeHidden: true
            });
            expect(saved.map(t => [t.date.substring(0, 10), t.amount, t.isHidden])).toEqual([
                ['2026-05-07', -1234.56, true],
                ['2026-05-08', 12, false]
            ]);
        });

        it('TXN-3.2 should refuse a file with missing columns with a 400', async () => {
            const response = await request(app)
                .post('/transactions/import?dryRun=true')
                .attach(
                    'file',
                    Buffer.from(
                        'Date,AccountName,Merchant,CategoryName,Amount,Notes\n2026-06-06,Checking,Test,Groceries,1,'
                    ),
                    'import.csv'
                );

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Missing required CSV headers: OriginalStatement, IsHidden');
        });

        it('TXN-3.2 should refuse a file with no data rows with a 400', async () => {
            const response = await importCsv('', '?dryRun=true');

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('The CSV file has no data rows.');
        });

        it('TXN-3.2 should refuse a request with no file with a 400', async () => {
            const response = await request(app).post('/transactions/import?dryRun=true');

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('No file provided.');
        });

        it('TXN-3.5 should put every row in the target account, ignoring AccountName', async () => {
            const response = await importCsv(
                '2026-06-06,Someone Else,Test,Groceries,1,,,false',
                `?accountId=${testAccountId}`
            );

            expect(response.status).toBe(201);
            const saved = await transactionsData.search({ includeHidden: true });
            expect(saved.map(t => t.accountId)).toEqual([testAccountId]);
        });

        it('TXN-3.5 should refuse an import into an account that does not exist', async () => {
            const response = await importCsv(
                '2026-06-06,Checking,Test,Groceries,1,,,false',
                '?dryRun=true&accountId=missing'
            );

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Account not found.');
        });

        it('TXN-3.1 TXN-3.10 should re-import its own export unchanged, spaces in its text included', async () => {
            await insertTransaction({
                date: '2026-06-06',
                amount: -12.5,
                merchant: 'Café, "Quoted"',
                originalStatement: 'BIG STORE U*** ',
                notes: ' Line one',
                isHidden: true
            });
            const exported = await request(app).get('/transactions/export');
            await pglite.exec('DELETE FROM finance.transactions');

            const response = await request(app)
                .post('/transactions/import')
                .attach('file', Buffer.from(exported.text), 'export.csv');

            expect(response.status).toBe(201);
            const saved = await transactionsData.search({ includeHidden: true });
            expect(saved).toEqual([
                expect.objectContaining({
                    date: '2026-06-06',
                    amount: -12.5,
                    merchant: 'Café, "Quoted"',
                    originalStatement: 'BIG STORE U*** ',
                    notes: ' Line one',
                    isHidden: true
                })
            ]);
        });

        it('TXN-3.10 should still trim the cells it parses or looks up', async () => {
            const response = await importCsv(' 2026-06-06 , checking , Shop , Groceries , -5.00 ,,, TRUE ');

            expect(response.status).toBe(201);
            const [saved] = await transactionsData.search({ includeHidden: true });
            expect(saved).toMatchObject({
                date: '2026-06-06',
                accountId: testAccountId,
                categoryId: testCategoryId,
                amount: -5,
                merchant: ' Shop ',
                isHidden: true
            });
        });

        describe('rows already imported (TXN-3.12)', () => {
            const idHeader = `Id,${csvHeader}`;

            function importWithIds(rows: string, query = ''): request.Test {
                return request(app)
                    .post(`/transactions/import${query}`)
                    .attach('file', Buffer.from(idHeader + rows), 'import.csv');
            }

            it('TXN-3.12 TXN-3.3 should skip every row of its own export when imported again', async () => {
                await insertTransaction({ amount: -5 });
                await insertTransaction({ amount: -5 });
                const exported = await request(app).get('/transactions/export');
                const upload = () =>
                    request(app).post('/transactions/import').attach('file', Buffer.from(exported.text), 'export.csv');

                const dryRun = await upload().query({ dryRun: true });
                const imported = await upload();

                expect(dryRun.body).toMatchObject({ createdCount: 0, duplicateCount: 2, isValidToImport: true });
                expect(imported.status).toBe(201);
                expect(imported.body).toMatchObject({ createdCount: 0, duplicateCount: 2 });
                expect(await countTransactions()).toBe(2);
            });

            it("TXN-3.12 should create a row whose Id isn't in the account it goes to", async () => {
                const transaction = await insertTransaction({ amount: -5 });
                const savingsId = await insertAccount({});

                const elsewhere = await importWithIds(
                    `${transaction.id},2026-06-06,Checking,Shop,Groceries,-5,,,false\n`,
                    `?accountId=${savingsId}`
                );
                const unknown = await importWithIds('TRXgone,2026-06-06,Checking,Shop,Groceries,-5,,,false\n');

                expect(elsewhere.body).toMatchObject({ createdCount: 1, duplicateCount: 0 });
                expect(unknown.body).toMatchObject({ createdCount: 1, duplicateCount: 0 });
                expect(await countTransactions()).toBe(3);
            });

            it('TXN-3.12 should match a row without an Id on date, account, amount and statement, one for one', async () => {
                await insertTransaction({ date: '2026-06-06', amount: -5, originalStatement: 'COFFEE 1' });

                const response = await importCsv(
                    [
                        '2026-06-06,Checking,Coffee,,-5.00,COFFEE 1,,false',
                        '2026-06-06,Checking,Coffee,,-5.00,COFFEE 1,,false',
                        '2026-06-06,Checking,Coffee,,-5.00,COFFEE 2,,false',
                        '2026-06-05,Checking,Coffee,,-5.00,COFFEE 1,,false',
                        '2026-06-06,Checking,Coffee,,-6.00,COFFEE 1,,false'
                    ].join('\n'),
                    '?dryRun=true'
                );

                expect(response.body).toMatchObject({ createdCount: 4, duplicateCount: 1 });
            });

            it("TXN-3.12 should match a split's parts as one transaction for their total", async () => {
                const transaction = await insertTransaction({ amount: -200, originalStatement: 'BIG STORE' });
                await request(app)
                    .put(`/transactions/${transaction.id}/split`)
                    .send({
                        parts: [
                            { id: transaction.id, amount: -101, merchant: 'Big Store' },
                            { amount: -99, merchant: 'Big Store' }
                        ]
                    })
                    .expect(200);

                const response = await importCsv(
                    '2026-06-06,Checking,Big Store,,-200.00,BIG STORE,,false',
                    '?dryRun=true'
                );

                expect(response.body).toMatchObject({ createdCount: 0, duplicateCount: 1 });
            });

            it('TXN-3.11 TXN-3.12 should adjust balances for the rows it creates only', async () => {
                const manual = await accountsData.insert(
                    EntityFactory.createAccount({
                        institutionId: testInstitutionId,
                        name: 'Wallet',
                        type: AccountType.Checking,
                        isHidden: false,
                        isManual: true,
                        balance: 0
                    })
                );
                await insertTransaction({ accountId: manual.id, amount: -5, originalStatement: 'A' });

                await importCsv(
                    '2026-06-06,Wallet,A,,-5.00,A,,false\n2026-06-06,Wallet,B,,-7.00,B,,false',
                    `?accountId=${manual.id}&adjustBalances=true`
                ).expect(201);

                const result = await pglite.query<{ balance: string }>(
                    'SELECT balance FROM finance.balance_history WHERE account_id = $1',
                    [manual.id]
                );
                expect(result.rows.map(r => Number(r.balance))).toEqual([-7]);
            });
        });

        it('APP-5.4 should reject a file larger than 5 MB', async () => {
            const header = 'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden\n';
            const bigFile = Buffer.concat([Buffer.from(header), Buffer.alloc(5 * 1024 * 1024 + 1, 'a')]);

            const response = await request(app)
                .post('/transactions/import?dryRun=true')
                .attach('file', bigFile, 'import.csv');

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ code: 'BAD_REQUEST', message: 'File is too large (maximum 5 MB).' });
        });

        it('APP-5.4 should reject more than one file', async () => {
            const csvContent =
                'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden\n2026-06-06,Checking,Test,Groceries,100,,,false';

            const response = await request(app)
                .post('/transactions/import?dryRun=true')
                .attach('file', Buffer.from(csvContent), 'a.csv')
                .attach('file', Buffer.from(csvContent), 'b.csv');

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('BAD_REQUEST');
        });
    });

    describe('POST / (Uncategorized)', () => {
        it('CAT-5.2 should save a transaction without a category as Uncategorized', async () => {
            const payload = { accountId: testAccountId, date: '2026-06-06', amount: 10, merchant: 'Test' };

            const response = await request(app).post('/transactions').send(payload);

            expect(response.status).toBe(201);
            expect(response.body.categoryId).toBe('');
            expect((await transactionsData.retrieveSingle(response.body.id))?.categoryId).toBe('');
        });

        it('CAT-5.2 should make a transaction Uncategorized when its category is cleared', async () => {
            const txn = await insertTransaction();

            const response = await request(app).put(`/transactions/${txn.id}`).send({ categoryId: '' });

            expect(response.status).toBe(200);
            expect(response.body.categoryId).toBe('');
        });
    });

    describe('POST / (invalid requests)', () => {
        it('APP-5.5 should reject a transaction whose category does not exist', async () => {
            const payload = {
                accountId: testAccountId,
                categoryId: 'no-such-category',
                date: '2026-06-06',
                amount: 10,
                merchant: 'Test',
                isHidden: false,
                originalStatement: '',
                notes: ''
            };

            const response = await request(app).post('/transactions').send(payload);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ code: 'INVALID_REFERENCE', message: 'Category not found.' });
        });

        it('APP-5.5 should return a JSON 400 for a malformed JSON body', async () => {
            const response = await request(app)
                .post('/transactions')
                .set('Content-Type', 'application/json')
                .send('{"accountId": ');

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ code: 'BAD_REQUEST', message: 'Malformed JSON in request body.' });
        });
    });

    describe('GET / (search)', () => {
        it('TXN-1.11 should include transactions whose category was deleted', async () => {
            const txn = await insertTransaction();
            await pglite.exec(`DELETE FROM finance.categories WHERE id = '${testCategoryId}'`);

            const response = await request(app).get('/transactions');

            expect(response.status).toBe(200);
            expect(response.body).toEqual([expect.objectContaining({ id: txn.id, categoryId: '' })]);
        });

        it('TXN-1.11 should filter for Uncategorized like any other category', async () => {
            const uncategorized = await insertTransaction({ categoryId: '', merchant: 'Unknown' });
            await insertTransaction({ merchant: 'Known' });
            const filters = JSON.stringify([{ key: TransactionsFilterKey.Category, value: Uncategorized.filterValue }]);

            const response = await request(app).get('/transactions').query({ filters });

            expect(response.status).toBe(200);
            expect(response.body.map((t: Transaction) => t.id)).toEqual([uncategorized.id]);
        });

        it('TXN-1.2 should sort by account name and by category name, ignoring case', async () => {
            const inst = await institutionsData.insert(EntityFactory.createInstitution({ name: 'Other Bank' }));
            const savings = await accountsData.insert(
                EntityFactory.createAccount({
                    institutionId: inst.id,
                    name: 'savings',
                    type: AccountType.Savings
                })
            );
            const group = await groupsData.insert(
                EntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Home' })
            );
            const rent = await categoriesData.insert(
                EntityFactory.createCategory({ groupId: group.id, name: 'rent', icon: '🏠', isActive: true })
            );

            const checkingGroceries = await insertTransaction({ merchant: 'A' });
            const savingsRent = await insertTransaction({ accountId: savings.id, categoryId: rent.id, merchant: 'B' });

            const byAccount = await request(app)
                .get('/transactions')
                .query({ sortKey: TransactionsSortKey.Account, sortDirection: 'desc' });
            const byCategory = await request(app)
                .get('/transactions')
                .query({ sortKey: TransactionsSortKey.Category, sortDirection: 'asc' });

            expect(byAccount.body.map((t: Transaction) => t.id)).toEqual([savingsRent.id, checkingGroceries.id]);
            expect(byCategory.body.map((t: Transaction) => t.id)).toEqual([checkingGroceries.id, savingsRent.id]);
        });

        it('TXN-1.5 should include transactions on both the start and end dates, returned as YYYY-MM-DD', async () => {
            for (const date of ['2026-06-05', '2026-06-06', '2026-06-07', '2026-06-08']) {
                await insertTransaction({ date });
            }

            const response = await request(app)
                .get('/transactions')
                .query({ startDate: '2026-06-06', endDate: '2026-06-07' });

            expect(response.body.map((t: Transaction) => t.date)).toEqual(['2026-06-07', '2026-06-06']);
        });

        it('TXN-1.6 should match merchant text literally, not as a LIKE pattern', async () => {
            await insertTransaction({ merchant: '100% Juice' });
            await insertTransaction({ merchant: '1000 Things' });

            const response = await request(app)
                .get('/transactions')
                .query({ filters: JSON.stringify([{ key: TransactionsFilterKey.Merchant, value: '100%' }]) });

            expect(response.body.map((t: Transaction) => t.merchant)).toEqual(['100% Juice']);
        });

        it.each([
            [{ filters: 'not json' }, 'filters: Invalid JSON'],
            [
                { filters: JSON.stringify([{ key: 'nope', value: 'x' }]) },
                'filters: Expected an array of { key, value } filters'
            ],
            [{ startDate: 'not a date' }, 'startDate: Expected a date as YYYY-MM-DD'],
            [{ endDate: '2026-06-06T00:00:00.000Z' }, 'endDate: Expected a date as YYYY-MM-DD'],
            [{ sortKey: 'account_id' }, 'sortKey:']
        ])('APP-5.7 should reject invalid search options %p', async (query, message) => {
            const response = await request(app).get('/transactions').query(query);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain(message);
        });
    });

    describe('POST / and PUT /:id (references and field rules)', () => {
        it('TXN-2.5 should reject a transaction whose account does not exist', async () => {
            const payload = {
                accountId: 'no-such-account',
                categoryId: testCategoryId,
                date: '2026-06-06',
                amount: 10,
                merchant: 'Test'
            };

            const response = await request(app).post('/transactions').send(payload);

            expect(response.status).toBe(400);
            expect(response.body).toEqual({ code: 'INVALID_REFERENCE', message: 'Account not found.' });
        });

        it('APP-5.7 should reject an amount too large for the database', async () => {
            const payload = {
                accountId: testAccountId,
                categoryId: testCategoryId,
                date: '2026-06-06',
                amount: 1e10,
                merchant: 'Test'
            };

            const response = await request(app).post('/transactions').send(payload);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('amount:');
        });

        it('APP-5.7 should reject a date that is not a date', async () => {
            const payload = {
                accountId: testAccountId,
                categoryId: testCategoryId,
                date: 'soon',
                amount: 1,
                merchant: 'Test'
            };

            const response = await request(app).post('/transactions').send(payload);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('date: Expected a date as YYYY-MM-DD');
        });

        it('TXN-2.3 should change only the fields sent', async () => {
            const txn = await insertTransaction({ notes: 'Keep me', amount: -5 });

            const response = await request(app).put(`/transactions/${txn.id}`).send({ merchant: 'Renamed' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual(
                expect.objectContaining({
                    merchant: 'Renamed',
                    notes: 'Keep me',
                    amount: -5,
                    categoryId: testCategoryId,
                    date: txn.date
                })
            );
        });

        it('TXN-2.3 should move a transaction to another account', async () => {
            const inst = await institutionsData.insert(EntityFactory.createInstitution({ name: 'Other Bank' }));
            const other = await accountsData.insert(
                EntityFactory.createAccount({
                    institutionId: inst.id,
                    name: 'Other',
                    type: AccountType.Checking
                })
            );
            const txn = await insertTransaction();

            const response = await request(app).put(`/transactions/${txn.id}`).send({ accountId: other.id });

            expect(response.status).toBe(200);
            expect((await transactionsData.retrieveSingle(txn.id))?.accountId).toBe(other.id);
        });

        it('TXN-2.3 should save an edit to an uncategorized transaction without touching its category', async () => {
            const txn = await insertTransaction();
            await pglite.exec(`DELETE FROM finance.categories WHERE id = '${testCategoryId}'`);

            const response = await request(app).put(`/transactions/${txn.id}`).send({ notes: 'Edited' });

            expect(response.status).toBe(200);
            expect(response.body).toEqual(expect.objectContaining({ notes: 'Edited', categoryId: '' }));
        });
    });

    describe('balance adjustments (ACCT-5)', () => {
        const Set = BalanceEntrySource.Set;
        const Adjusted = BalanceEntrySource.Adjusted;
        let manualAccountId: string;

        beforeEach(async () => {
            const account = await accountsData.insert(
                EntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Wallet',
                    type: AccountType.Checking,
                    isHidden: false,
                    isManual: true,
                    balance: 0
                })
            );
            manualAccountId = account.id!;
        });

        async function seedBalances(entries: [string, number, BalanceEntrySource][], accountId = manualAccountId) {
            await new BalanceHistoryData(dbClient).insertBulk(
                entries.map(([date, balance, source]) =>
                    EntityFactory.createBalanceHistory({ accountId, date, balance, source })
                )
            );
        }

        async function balances(accountId = manualAccountId): Promise<[string, number, string][]> {
            const result = await pglite.query<{ date: string; balance: string; source: string }>(
                `SELECT to_char(date, 'YYYY-MM-DD') AS date, balance, source FROM finance.balance_history
                 WHERE account_id = $1 ORDER BY date`,
                [accountId]
            );
            return result.rows.map(r => [r.date, Number(r.balance), r.source]);
        }

        async function amounts(accountId = manualAccountId): Promise<number[]> {
            return (await balances(accountId)).map(([, balance]) => balance);
        }

        function post(fields: object) {
            return request(app)
                .post('/transactions')
                .send({ accountId: manualAccountId, date: '2026-05-05', amount: -50, merchant: 'Shop', ...fields });
        }

        async function postAdjusting(fields: object = {}): Promise<Transaction> {
            const response = await post({ adjustsBalance: true, ...fields });
            expect(response.status).toBe(201);
            return response.body;
        }

        const history: [string, number, BalanceEntrySource][] = [
            ['2026-05-01', 1000, Set],
            ['2026-05-10', 900, Adjusted],
            ['2026-05-20', 500, Set],
            ['2026-05-25', 450, Adjusted]
        ];

        it('ACCT-5.2 TXN-2.8 should add the amount from its date up to the next set entry, creating an entry on its date', async () => {
            await seedBalances(history);

            const created = await postAdjusting();

            expect(created.adjustsBalance).toBe(true);
            expect(await balances()).toEqual([
                ['2026-05-01', 1000, Set],
                ['2026-05-05', 950, Adjusted],
                ['2026-05-10', 850, Adjusted],
                ['2026-05-20', 500, Set],
                ['2026-05-25', 450, Adjusted]
            ]);
        });

        it('ACCT-5.2 should shift an entry on its own date even if it is a set entry, and run on when no set entry follows', async () => {
            await seedBalances(history);

            await postAdjusting({ date: '2026-05-20', amount: 25.5 });

            expect(await balances()).toEqual([
                ['2026-05-01', 1000, Set],
                ['2026-05-10', 900, Adjusted],
                ['2026-05-20', 525.5, Set],
                ['2026-05-25', 475.5, Adjusted]
            ]);
        });

        it('ACCT-5.2 should start from 0 when there is no earlier entry', async () => {
            await seedBalances([['2026-05-10', 900, Set]]);

            await postAdjusting({ date: '2026-05-01', amount: -20 });

            expect(await balances()).toEqual([
                ['2026-05-01', -20, Adjusted],
                ['2026-05-10', 900, Set]
            ]);
        });

        it('ACCT-5.4 should make a liability more negative for a purchase and less for a payment', async () => {
            await seedBalances([['2026-05-01', -300, Set]]);

            await postAdjusting({ date: '2026-05-02', amount: -50 });
            await postAdjusting({ date: '2026-05-03', amount: 200 });

            expect(await amounts()).toEqual([-300, -350, -150]);
        });

        it('TXN-2.8 TXN-2.10 should leave balances alone without Adjust balance, or when hidden', async () => {
            await seedBalances(history);

            const plain = await post({});
            await postAdjusting({ isHidden: true });

            expect(plain.status).toBe(201);
            expect(plain.body.adjustsBalance).toBe(false);
            expect(await balances()).toEqual(history);
        });

        it('ACCT-5.3 should undo and reapply a change of amount, date or account', async () => {
            await seedBalances(history);
            const otherId = await insertAccount({});
            await accountsData.update({ ...(await accountsData.retrieveSingle(otherId))!, isManual: true });
            const created = await postAdjusting();

            await request(app).put(`/transactions/${created.id}`).send({ amount: -70, date: '2026-05-12' });
            expect(await balances()).toEqual([
                ['2026-05-01', 1000, Set],
                ['2026-05-05', 1000, Adjusted],
                ['2026-05-10', 900, Adjusted],
                ['2026-05-12', 830, Adjusted],
                ['2026-05-20', 500, Set],
                ['2026-05-25', 450, Adjusted]
            ]);

            await request(app).put(`/transactions/${created.id}`).send({ accountId: otherId });
            expect(await amounts()).toEqual([1000, 1000, 900, 900, 500, 450]);
            expect(await balances(otherId)).toEqual([['2026-05-12', -70, Adjusted]]);
        });

        it('ACCT-5.3 TXN-2.8 should undo when Adjust balance is cleared and apply when it is checked', async () => {
            await seedBalances(history);
            const created = await postAdjusting();

            await request(app).put(`/transactions/${created.id}`).send({ adjustsBalance: false });
            expect(await amounts()).toEqual([1000, 1000, 900, 500, 450]);

            await request(app).put(`/transactions/${created.id}`).send({ adjustsBalance: true });
            expect(await amounts()).toEqual([1000, 950, 850, 500, 450]);
        });

        it('ACCT-5.3 should leave balances alone when only the merchant, category or notes change', async () => {
            await seedBalances(history);
            const created = await postAdjusting();
            // A balance set on its date afterwards already counts it; editing the details mustn't move it again.
            await pglite.query(
                `UPDATE finance.balance_history SET balance = 700, source = 'set' WHERE account_id = $1 AND date = '2026-05-05'`,
                [manualAccountId]
            );
            const before = await balances();

            const response = await request(app)
                .put(`/transactions/${created.id}`)
                .send({ merchant: 'Market', notes: 'Weekly', categoryId: testCategoryId });

            expect(response.status).toBe(200);
            expect(await balances()).toEqual(before);
        });

        it('ACCT-5.3 should undo when deleted', async () => {
            await seedBalances(history);
            const created = await postAdjusting();

            const response = await request(app).delete(`/transactions/${created.id}`);

            expect(response.status).toBe(204);
            expect(await amounts()).toEqual([1000, 1000, 900, 500, 450]);
        });

        it('ACCT-5.3 should create no entry when undoing on a date whose entries were replaced since', async () => {
            await seedBalances([['2026-05-01', 1000, Set]]);
            const created = await postAdjusting();
            // An import over the date replaces its entries with ones that already count the transaction.
            await new BalanceHistoryData(dbClient).replaceRange(manualAccountId, '2026-05-01', '2026-05-10', [
                EntityFactory.createBalanceHistory({
                    accountId: manualAccountId,
                    date: '2026-05-10',
                    balance: 940
                })
            ]);

            await request(app).delete(`/transactions/${created.id}`);

            expect(await balances()).toEqual([['2026-05-10', 940, Set]]);
        });

        it('TXN-2.10 should undo when hidden and apply again when shown', async () => {
            await seedBalances(history);
            const created = await postAdjusting();

            await request(app).put(`/transactions/${created.id}`).send({ isHidden: true });
            expect(await amounts()).toEqual([1000, 1000, 900, 500, 450]);

            await request(app).put(`/transactions/${created.id}`).send({ isHidden: false });
            expect(await amounts()).toEqual([1000, 950, 850, 500, 450]);
        });

        it('TXN-4.7 should keep the balances as for one transaction of the total through split, hide, move and delete', async () => {
            await seedBalances(history);
            const created = await postAdjusting();
            const before = await balances();

            const split = await request(app)
                .put(`/transactions/${created.id}/split`)
                .send({
                    parts: [
                        { id: created.id, amount: -20, merchant: 'Shop' },
                        { amount: -30, merchant: 'Shop' }
                    ]
                })
                .expect(200);
            const added = split.body[1];
            expect(added).toMatchObject({ date: '2026-05-05', adjustsBalance: true });
            expect(await balances()).toEqual(before);

            await request(app).put(`/transactions/${added.id}`).send({ isHidden: true }).expect(200);
            expect(await amounts()).toEqual([1000, 1000, 900, 500, 450]);
            await request(app).put(`/transactions/${added.id}`).send({ isHidden: false }).expect(200);
            expect(await balances()).toEqual(before);

            await request(app).put(`/transactions/${created.id}`).send({ date: '2026-05-15' }).expect(200);
            expect(await amounts()).toEqual([1000, 1000, 900, 850, 500, 450]);

            await request(app).delete(`/transactions/${added.id}`).expect(204);
            expect(await amounts()).toEqual([1000, 1000, 900, 900, 500, 450]);
            expect(await countTransactions()).toBe(0);
        });

        it('ACCT-4.4 ACCT-5.5 should refuse Adjust balance for a connected account', async () => {
            const create = await post({ accountId: testAccountId, adjustsBalance: true });
            const plain = await insertTransaction();
            const update = await request(app).put(`/transactions/${plain.id}`).send({ adjustsBalance: true });

            for (const response of [create, update]) {
                expect(response.status).toBe(400);
                expect(response.body.message).toBe("A connected account's balance comes from its bank.");
            }
            expect(await balances(testAccountId)).toEqual([]);
        });

        it("ACCT-6.3 should refuse to change a closed account's balance through its transactions", async () => {
            await seedBalances([['2026-05-01', 1000, Set]]);
            const created = await postAdjusting();
            await accountsData.close(manualAccountId, '2026-05-15');
            const before = await balances();

            const refused = [
                await post({ adjustsBalance: true }),
                await request(app).put(`/transactions/${created.id}`).send({ amount: -10 }),
                await request(app).put(`/transactions/${created.id}`).send({ isHidden: true }),
                await request(app).delete(`/transactions/${created.id}`)
            ];
            for (const response of refused) {
                expect(response.status).toBe(400);
                expect(response.body.message).toBe('Reopen this account to change its balance.');
            }

            const rename = await request(app).put(`/transactions/${created.id}`).send({ merchant: 'Market' });
            const plain = await post({});
            expect(rename.status).toBe(200);
            expect(plain.status).toBe(201);
            expect(await balances()).toEqual(before);
        });

        it('ACCT-5.6 should save neither the transaction nor its balance change when the balances fail to save', async () => {
            await seedBalances(history);
            await pglite.exec(`
                CREATE FUNCTION finance.reject_balance() RETURNS trigger AS $$
                BEGIN
                    IF NEW.balance = 850 THEN RAISE EXCEPTION 'boom'; END IF;
                    RETURN NEW;
                END $$ LANGUAGE plpgsql;
                CREATE TRIGGER reject_balance BEFORE UPDATE ON finance.balance_history
                    FOR EACH ROW EXECUTE FUNCTION finance.reject_balance();
            `);

            try {
                const response = await post({ adjustsBalance: true });

                expect(response.status).toBe(500);
                expect(await countTransactions()).toBe(0);
                expect(await balances()).toEqual(history);
            } finally {
                await pglite.exec(
                    'DROP TRIGGER reject_balance ON finance.balance_history; DROP FUNCTION finance.reject_balance();'
                );
            }
        });

        describe('POST /import with Adjust balances (TXN-3.11)', () => {
            const rows = [
                '2026-05-05,Anything,Shop,,-50,,,false',
                '2026-05-05,Anything,Cafe,,-4.10,,,false',
                '2026-05-12,Anything,Refund,,30,,,false',
                '2026-05-12,Anything,Hidden,,-1000,,,true'
            ].join('\n');

            async function adjustsBalanceFlags(): Promise<boolean[]> {
                const result = await pglite.query<{ adjusts_balance: boolean }>(
                    'SELECT adjusts_balance FROM finance.transactions ORDER BY merchant'
                );
                return result.rows.map(r => r.adjusts_balance);
            }

            it('TXN-3.11 ACCT-5.2 should adjust the account it imports into, leaving hidden rows out', async () => {
                await seedBalances(history);

                const response = await importCsv(rows, `?accountId=${manualAccountId}&adjustBalances=true`);

                expect(response.status).toBe(201);
                expect(await balances()).toEqual([
                    ['2026-05-01', 1000, Set],
                    ['2026-05-05', 945.9, Adjusted],
                    ['2026-05-10', 845.9, Adjusted],
                    ['2026-05-12', 875.9, Adjusted],
                    ['2026-05-20', 500, Set],
                    ['2026-05-25', 450, Adjusted]
                ]);
                expect(await adjustsBalanceFlags()).toEqual([true, true, true, true]);
            });

            it('TXN-3.11 should leave balances alone by default', async () => {
                await seedBalances(history);

                const response = await importCsv(rows, `?accountId=${manualAccountId}`);

                expect(response.status).toBe(201);
                expect(await balances()).toEqual(history);
                expect(await adjustsBalanceFlags()).toEqual([false, false, false, false]);
            });

            it('TXN-3.11 should refuse Adjust balances without an account, or for a connected or closed one', async () => {
                await accountsData.close(manualAccountId, '2026-05-15');

                const cases: [string, string][] = [
                    ['?adjustBalances=true', 'Import into an account to adjust its balances.'],
                    [
                        `?accountId=${testAccountId}&adjustBalances=true`,
                        "A connected account's balance comes from its bank."
                    ],
                    [
                        `?accountId=${manualAccountId}&adjustBalances=true&dryRun=true`,
                        'Reopen this account to change its balance.'
                    ]
                ];
                for (const [query, message] of cases) {
                    const response = await importCsv(rows, query);
                    expect(response.status).toBe(400);
                    expect(response.body.message).toBe(message);
                }
                expect(await countTransactions()).toBe(0);
            });

            it('TXN-3.9 ACCT-5.6 should import nothing when the balances fail to save', async () => {
                await seedBalances(history);
                await pglite.exec(`
                    CREATE FUNCTION finance.reject_balance() RETURNS trigger AS $$
                    BEGIN
                        IF NEW.balance = 875.9 THEN RAISE EXCEPTION 'boom'; END IF;
                        RETURN NEW;
                    END $$ LANGUAGE plpgsql;
                    CREATE TRIGGER reject_balance BEFORE UPDATE ON finance.balance_history
                        FOR EACH ROW EXECUTE FUNCTION finance.reject_balance();
                `);

                try {
                    const response = await importCsv(rows, `?accountId=${manualAccountId}&adjustBalances=true`);

                    expect(response.status).toBe(500);
                    expect(await countTransactions()).toBe(0);
                    expect(await balances()).toEqual(history);
                } finally {
                    await pglite.exec(
                        'DROP TRIGGER reject_balance ON finance.balance_history; DROP FUNCTION finance.reject_balance();'
                    );
                }
            });
        });
    });

    describe('split transactions (TXN-4)', () => {
        let dining: string;

        beforeEach(async () => {
            const group = await groupsData.insert(
                EntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Going Out' })
            );
            const category = await categoriesData.insert(
                EntityFactory.createCategory({ groupId: group.id!, name: 'Dining', icon: '', isActive: true })
            );
            dining = category.id!;
        });

        function split(id: string, parts: object[]): request.Test {
            return request(app).put(`/transactions/${id}/split`).send({ parts });
        }

        // Splits a $100 purchase into $60 of groceries and $40 of dining.
        async function insertSplit(fields: Partial<Transaction> = {}): Promise<Transaction[]> {
            const transaction = await insertTransaction({
                amount: -100,
                merchant: 'Big Store',
                originalStatement: 'BIG STORE 123',
                notes: 'receipt',
                ...fields
            });
            const response = await split(transaction.id, [
                { id: transaction.id, amount: -60, categoryId: testCategoryId, merchant: 'Big Store', notes: 'food' },
                { amount: -40, categoryId: dining, merchant: 'Big Store Cafe' }
            ]);
            expect(response.status).toBe(200);
            return response.body;
        }

        it('TXN-4.1 TXN-4.2 should turn a transaction into parts that are transactions sharing its date, account and statement', async () => {
            const [first, second] = await insertSplit();

            expect(first).toMatchObject({
                amount: -60,
                categoryId: testCategoryId,
                merchant: 'Big Store',
                notes: 'food'
            });
            expect(second).toMatchObject({ amount: -40, categoryId: dining, merchant: 'Big Store Cafe', notes: '' });
            for (const part of [first, second]) {
                expect(part).toMatchObject({
                    accountId: testAccountId,
                    date: '2026-06-06',
                    originalStatement: 'BIG STORE 123',
                    isHidden: false,
                    splitId: first.splitId
                });
            }
            expect(first.splitId).not.toBe('');

            const fetched = await request(app).get(`/transactions/${second.id}/split`);
            expect(fetched.body.map((t: Transaction) => t.id)).toEqual([first.id, second.id]);
        });

        it("TXN-4.5 should return no parts for a transaction that isn't split, and 404 for a missing one", async () => {
            const transaction = await insertTransaction();

            expect((await request(app).get(`/transactions/${transaction.id}/split`)).body).toEqual([]);
            await request(app).get('/transactions/missing/split').expect(404);
        });

        it('TXN-4.4 should list each part as its own transaction, so a category filter finds just that part', async () => {
            const [, second] = await insertSplit();

            const all = await request(app).get('/transactions');
            const dined = await request(app)
                .get('/transactions')
                .query({ filters: JSON.stringify([{ key: TransactionsFilterKey.Category, value: dining }]) });

            expect(all.body).toHaveLength(2);
            expect(dined.body.map((t: Transaction) => t.id)).toEqual([second.id]);
        });

        it('TXN-4.6 CASH-1.2 should count each part under its own category', async () => {
            await insertSplit();

            const response = await request(app).get('/transactions/spending?period=Monthly&asOfDate=2026-06-15');

            expect(response.body).toHaveLength(2);
            expect(response.body).toEqual(
                expect.arrayContaining([
                    { categoryId: testCategoryId, type: CategoryType.Expense, amount: 60 },
                    { categoryId: dining, type: CategoryType.Expense, amount: 40 }
                ])
            );
        });

        it("TXN-4.2 should refuse parts that don't add up, or a part in the other direction", async () => {
            const transaction = await insertTransaction({ amount: -100 });

            const short = await split(transaction.id, [
                { amount: -60, merchant: 'Big Store' },
                { amount: -40.01, merchant: 'Big Store' }
            ]);
            const opposite = await split(transaction.id, [
                { amount: -120, merchant: 'Big Store' },
                { amount: 20, merchant: 'Big Store' }
            ]);

            expect(short.status).toBe(400);
            expect(short.body.message).toBe("The parts' amounts must add up to the transaction's amount.");
            expect(opposite.status).toBe(400);
            expect(opposite.body.message).toBe('Every part must be money out, like the transaction.');
            expect(await countTransactions()).toBe(1);
        });

        it('TXN-4.1 TXN-4.2 should refuse fewer than 2 or more than 20 parts, a part of 0, or a part without a merchant', async () => {
            const transaction = await insertTransaction({ amount: -100 });
            const part = (amount: number) => ({ amount, merchant: 'Big Store' });

            await split(transaction.id, [part(-100)]).expect(400);
            await split(
                transaction.id,
                Array.from({ length: 21 }, () => part(-100 / 21))
            ).expect(400);
            await split(transaction.id, [part(-100), part(0)]).expect(400);
            await split(transaction.id, [part(-50), { amount: -50, merchant: '' }]).expect(400);
            const twenty = await split(
                transaction.id,
                Array.from({ length: 20 }, () => part(-5))
            );
            expect(twenty.status).toBe(200);
            expect(await countTransactions()).toBe(20);
        });

        it("APP-5.5 should refuse a part whose category doesn't exist, changing nothing", async () => {
            const transaction = await insertTransaction({ amount: -100 });

            const response = await split(transaction.id, [
                { id: transaction.id, amount: -60, merchant: 'Big Store' },
                { amount: -40, categoryId: 'missing', merchant: 'Big Store' }
            ]);

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Category not found.');
            expect(await transactionsData.retrieveSingle(transaction.id)).toMatchObject({ amount: -100, splitId: '' });
            expect(await countTransactions()).toBe(1);
        });

        it('TXN-4.5 should change, add and remove parts when the split is edited, from any part', async () => {
            const [first, second] = await insertSplit();

            const response = await split(second.id, [
                { id: second.id, amount: -10, categoryId: dining, merchant: 'Big Store Cafe' },
                { amount: -20, merchant: 'B' },
                { amount: -70, categoryId: testCategoryId, merchant: 'C' }
            ]);

            expect(response.status).toBe(200);
            expect(response.body.map((t: Transaction) => [t.amount, t.merchant])).toEqual([
                [-10, 'Big Store Cafe'],
                [-20, 'B'],
                [-70, 'C']
            ]);
            expect(response.body[0].id).toBe(second.id);
            expect(await transactionsData.retrieveSingle(first.id)).toBeNull();
            expect(await countTransactions()).toBe(3);
        });

        it("TXN-4.5 should refuse to keep a part that isn't in the split", async () => {
            await insertSplit();
            const other = await insertTransaction({ amount: -100 });

            const response = await split(other.id, [
                { id: other.id, amount: -50, merchant: 'A' },
                { id: 'not-a-part', amount: -50, merchant: 'B' }
            ]);

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('A part to keep is not part of this transaction.');
        });

        it("TXN-4.5 should unsplit from any part into its first part, with the total and the first part's category, merchant and notes", async () => {
            const [first, second] = await insertSplit();

            const response = await request(app).delete(`/transactions/${second.id}/split`);

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                id: first.id,
                amount: -100,
                categoryId: testCategoryId,
                merchant: 'Big Store',
                notes: 'food',
                splitId: ''
            });
            expect(await countTransactions()).toBe(1);
        });

        it("TXN-4.5 should refuse to unsplit a transaction that isn't split, and return 404 for a missing one", async () => {
            const transaction = await insertTransaction();

            const response = await request(app).delete(`/transactions/${transaction.id}/split`);

            expect(response.status).toBe(400);
            expect(response.body.message).toBe("This transaction isn't split.");
            await request(app).delete('/transactions/missing/split').expect(404);
            await split('missing', [
                { amount: -1, merchant: 'A' },
                { amount: -1, merchant: 'B' }
            ]).expect(404);
        });

        it("TXN-4.7 should refuse a change to a part's amount", async () => {
            const [first] = await insertSplit();

            const response = await request(app).put(`/transactions/${first.id}`).send({ amount: -90 });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe("Change a split transaction's amounts with Edit split.");
        });

        it("TXN-4.7 should change one part's category, merchant and notes, and every part's date, account, statement and hidden flag", async () => {
            const [first, second] = await insertSplit();
            const otherAccountId = await insertAccount({});

            const response = await request(app).put(`/transactions/${first.id}`).send({
                amount: -60,
                categoryId: dining,
                merchant: 'Renamed',
                notes: 'n',
                date: '2026-06-01',
                accountId: otherAccountId,
                originalStatement: 'NEW',
                isHidden: true
            });

            expect(response.status).toBe(200);
            const shared = { date: '2026-06-01', accountId: otherAccountId, originalStatement: 'NEW', isHidden: true };
            expect(await transactionsData.retrieveSingle(first.id)).toMatchObject({
                ...shared,
                categoryId: dining,
                merchant: 'Renamed',
                notes: 'n'
            });
            expect(await transactionsData.retrieveSingle(second.id)).toMatchObject({
                ...shared,
                amount: -40,
                merchant: 'Big Store Cafe',
                notes: ''
            });
        });

        it('TXN-4.7 should delete every part when one is deleted', async () => {
            const [, second] = await insertSplit();
            await insertTransaction();

            await request(app).delete(`/transactions/${second.id}`).expect(204);

            expect(await countTransactions()).toBe(1);
        });
    });
});
