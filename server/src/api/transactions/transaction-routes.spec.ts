import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { SortDirection } from '@shared/core/enum';
import {
    AccountCategory,
    AccountGroup,
    AccountType,
    CategoryType,
    TransactionsFilterKey,
    TransactionsSortKey
} from '@shared/finance/enum';
import { Transaction } from '@shared/finance/types';
import { Uncategorized } from '@shared/finance/util';
import { IAppLogger } from '@server/logging';
import { DatabaseClient, FinanceEntityFactory } from '@server/data';
import { TestExpressUtil, TestDatabaseUtil } from '@server/utility/testing';
import { FinanceAccountData } from './../accounts';
import { FinanceCategoryData, FinanceCategoryGroupData } from './../categories';
import { FinanceInstitutionData } from './../institutions';
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
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    beforeEach(async () => {
        await TestDatabaseUtil.clearFinanceData(pglite);

        const inst = await institutionsData.insert(FinanceEntityFactory.createInstitution({ name: 'Bank' }));
        testInstitutionId = inst.id!;
        const account = await accountsData.insert(
            FinanceEntityFactory.createAccount({
                institutionId: inst.id!,
                name: 'Checking',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking,
                isHidden: false,
                isManual: false,
                isRetirement: false,
                hideFromSpending: false,
                balance: 0
            })
        );
        testAccountId = account.id!;

        const group = await groupsData.insert(
            FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Food' })
        );
        const category = await categoriesData.insert(
            FinanceEntityFactory.createCategory({
                groupId: group.id!,
                name: 'Groceries',
                icon: 'apple',
                isActive: true
            })
        );
        testCategoryId = category.id!;
    });

    const csvHeader = 'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden\n';

    function insertTransaction(fields: Partial<Transaction> = {}): Promise<Transaction> {
        return transactionsData.insert(
            FinanceEntityFactory.createTransaction({
                accountId: testAccountId,
                categoryId: testCategoryId,
                date: '2026-06-06',
                amount: 100,
                merchant: 'Test Merchant',
                isHidden: false,
                isSplit: false,
                originalStatement: '',
                notes: '',
                splitParentId: '',
                ...fields
            })
        );
    }

    function importCsv(rows: string, query: string = ''): request.Test {
        return request(app)
            .post(`/transactions/import${query}`)
            .attach('file', Buffer.from(csvHeader + rows), 'import.csv');
    }

    async function countTransactions(): Promise<number> {
        const result = await pglite.query<{ count: number }>('SELECT count(*)::int AS count FROM finance.transactions');
        return result.rows[0].count;
    }

    describe('GET /', () => {
        it('should return a list of transactions when successful with default options', async () => {
            const txn1 = await transactionsData.insert(
                FinanceEntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Test Merchant 1',
                    isHidden: false,
                    isSplit: false,
                    originalStatement: '',
                    notes: '',
                    splitParentId: ''
                })
            );
            const txn2 = await transactionsData.insert(
                FinanceEntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-07',
                    amount: 200,
                    merchant: 'Test Merchant 2',
                    isHidden: false,
                    isSplit: false,
                    originalStatement: '',
                    notes: '',
                    splitParentId: ''
                })
            );

            const response = await request(app).get('/transactions');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map((t: any) => t.id)).toEqual(expect.arrayContaining([txn1.id, txn2.id]));
        });

        it('should parse and pass all search options correctly', async () => {
            const txn = await transactionsData.insert(
                FinanceEntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Test Merchant',
                    isHidden: false,
                    isSplit: false,
                    originalStatement: '',
                    notes: '',
                    splitParentId: ''
                })
            );

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
    });

    describe('POST /', () => {
        it('should create a new transaction when input is valid', async () => {
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

        it('should return 400 when schema validation fails (missing amount)', async () => {
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
        it('should return a list of merchants', async () => {
            await transactionsData.insert(
                FinanceEntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Amazon',
                    isHidden: false,
                    isSplit: false,
                    originalStatement: '',
                    notes: '',
                    splitParentId: ''
                })
            );
            await transactionsData.insert(
                FinanceEntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Walmart',
                    isHidden: false,
                    isSplit: false,
                    originalStatement: '',
                    notes: '',
                    splitParentId: ''
                })
            );

            const response = await request(app).get('/transactions/merchants');

            expect(response.status).toBe(200);
            expect(response.body).toEqual(expect.arrayContaining(['Amazon', 'Walmart']));
        });
    });

    describe('GET /spending', () => {
        it('should return spending by category', async () => {
            await transactionsData.insert(
                FinanceEntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 500,
                    merchant: 'Test Merchant',
                    isHidden: false,
                    isSplit: false,
                    originalStatement: '',
                    notes: '',
                    splitParentId: ''
                })
            );

            const response = await request(app).get('/transactions/spending?period=Monthly&asOfDate=2026-06-15');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].categoryId).toBe(testCategoryId);
            expect(response.body[0].amount).toBe(500);
        });

        it('APP-5.6 CASH-1.2 should count the first and last days of the month and nothing from the next, west of UTC', async () => {
            // Tests run with TZ=America/New_York (jest.config.js).
            await insertTransaction({ date: '2026-03-31', amount: -1 });
            await insertTransaction({ date: '2026-04-01', amount: -10 });
            await insertTransaction({ date: '2026-04-30', amount: -100 });
            await insertTransaction({ date: '2026-05-01', amount: -1000 });

            const response = await request(app).get('/transactions/spending?period=Monthly&asOfDate=2026-04-15');

            expect(response.body).toEqual([{ categoryId: testCategoryId, amount: -110 }]);
        });

        // A second account alongside Checking, with the given flags.
        async function insertAccount(flags: { isHidden?: boolean; hideFromSpending?: boolean }): Promise<string> {
            const account = await accountsData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Savings',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Savings,
                    isHidden: false,
                    isManual: false,
                    isRetirement: false,
                    hideFromSpending: false,
                    balance: 0,
                    ...flags
                })
            );
            return account.id!;
        }

        function getJune(): request.Test {
            return request(app).get('/transactions/spending?period=Monthly&asOfDate=2026-06-15');
        }

        it('CASH-1.2 should leave out hidden transactions', async () => {
            await insertTransaction({ amount: -10 });
            await insertTransaction({ amount: -100, isHidden: true });

            expect((await getJune()).body).toEqual([{ categoryId: testCategoryId, amount: -10 }]);
        });

        it('CASH-1.2 should leave out hidden accounts', async () => {
            const hiddenAccountId = await insertAccount({ isHidden: true });
            await insertTransaction({ amount: -10 });
            await insertTransaction({ accountId: hiddenAccountId, amount: -100 });

            expect((await getJune()).body).toEqual([{ categoryId: testCategoryId, amount: -10 }]);
        });

        it('ACCT-1.7 CASH-1.2 should leave out accounts flagged Hide from Spending', async () => {
            const excludedAccountId = await insertAccount({ hideFromSpending: true });
            await insertTransaction({ amount: -10 });
            await insertTransaction({ accountId: excludedAccountId, amount: -100 });

            expect((await getJune()).body).toEqual([{ categoryId: testCategoryId, amount: -10 }]);
        });

        it('CASH-1.3 should total uncategorized money in and money out separately', async () => {
            await insertTransaction({ categoryId: '', amount: 25 });
            await insertTransaction({ categoryId: '', amount: 15 });
            await insertTransaction({ categoryId: '', amount: -60 });
            await insertTransaction({ amount: 5 });
            await insertTransaction({ amount: -30 });

            const response = await getJune();

            expect(response.body).toHaveLength(3);
            expect(response.body).toEqual(
                expect.arrayContaining([
                    { categoryId: testCategoryId, amount: -25 },
                    { categoryId: '', amount: 40 },
                    { categoryId: '', amount: -60 }
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

    describe('GET /:id', () => {
        it('should return a single transaction when found', async () => {
            const txn = await transactionsData.insert(
                FinanceEntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Test Merchant',
                    isHidden: false,
                    isSplit: false,
                    originalStatement: '',
                    notes: '',
                    splitParentId: ''
                })
            );

            const response = await request(app).get(`/transactions/${txn.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(txn.id);
        });

        it('should return 404 when transaction is not found', async () => {
            const response = await request(app).get('/transactions/missing-id');

            expect(response.status).toBe(404);
        });
    });

    describe('PUT /:id', () => {
        it('should update a transaction when valid', async () => {
            const txn = await transactionsData.insert(
                FinanceEntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Test Merchant',
                    isHidden: false,
                    isSplit: false,
                    originalStatement: '',
                    notes: '',
                    splitParentId: ''
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

        it('should return 404 when update target does not exist', async () => {
            const response = await request(app).put('/transactions/txn-1').send({
                amount: 100,
                merchant: 'Updated',
                date: '2026-06-06',
                accountId: testAccountId,
                categoryId: testCategoryId,
                isHidden: false,
                isSplit: false
            });

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });
    });

    describe('DELETE /:id', () => {
        it('should delete a transaction', async () => {
            const txn = await transactionsData.insert(
                FinanceEntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Test Merchant',
                    isHidden: false,
                    isSplit: false,
                    originalStatement: '',
                    notes: '',
                    splitParentId: ''
                })
            );

            const response = await request(app).delete(`/transactions/${txn.id}`);

            expect(response.status).toBe(204);

            const dbTxn = await transactionsData.retrieveSingle(txn.id!);
            expect(dbTxn).toBeNull();
        });

        it('should return 404 when delete target does not exist', async () => {
            const response = await request(app).delete('/transactions/missing');

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });
    });

    describe('GET /export', () => {
        it('should return a CSV file of exported transactions', async () => {
            await transactionsData.insert(
                FinanceEntityFactory.createTransaction({
                    accountId: testAccountId,
                    categoryId: testCategoryId,
                    date: '2026-06-06',
                    amount: 100,
                    merchant: 'Test Merchant',
                    isHidden: false,
                    isSplit: false,
                    originalStatement: '',
                    notes: '',
                    splitParentId: ''
                })
            );

            const response = await request(app).get('/transactions/export');

            expect(response.status).toBe(200);
            expect(response.header['content-type']).toContain('text/csv');
            expect(response.text).toContain(
                'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden'
            );
            expect(response.text).toContain('Test Merchant');
        });

        it('TXN-3.1 should write dates as YYYY-MM-DD and amounts with two decimals', async () => {
            await insertTransaction({ date: '2026-06-06', amount: -12.5, merchant: 'Shop' });

            const response = await request(app).get('/transactions/export');

            expect(response.text).toBe(csvHeader + '2026-06-06,Checking,Shop,Groceries,-12.50,,,false\n');
        });

        it('TXN-3.1 should return 404 when exporting an account that does not exist', async () => {
            const response = await request(app).get('/transactions/export?accountId=missing');

            expect(response.status).toBe(404);
        });
    });

    describe('POST /import', () => {
        it('should process a CSV file and return import statistics', async () => {
            const csvContent =
                'Date,AccountName,Merchant,CategoryName,Amount,OriginalStatement,Notes,IsHidden\n2026-06-06,Checking,Test,Groceries,100,,,false';

            const response = await request(app)
                .post('/transactions/import')
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(201);
            expect(response.body.createdCount).toBe(1);
            expect(response.body.failedRowMessages.length).toBe(0);
        });

        it('should perform a dry run without saving when dryRun=true', async () => {
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

        it('TXN-3.1 should re-import its own export unchanged', async () => {
            await insertTransaction({
                date: '2026-06-06',
                amount: -12.5,
                merchant: 'Café, "Quoted"',
                notes: 'Line one',
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
                    notes: 'Line one',
                    isHidden: true
                })
            ]);
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
                isSplit: false,
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
            const inst = await institutionsData.insert(FinanceEntityFactory.createInstitution({ name: 'Other Bank' }));
            const savings = await accountsData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: inst.id,
                    name: 'savings',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
                    type: AccountType.Savings
                })
            );
            const group = await groupsData.insert(
                FinanceEntityFactory.createCategoryGroup({ type: CategoryType.Expense, name: 'Home' })
            );
            const rent = await categoriesData.insert(
                FinanceEntityFactory.createCategory({ groupId: group.id, name: 'rent', icon: 'home', isActive: true })
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
            const inst = await institutionsData.insert(FinanceEntityFactory.createInstitution({ name: 'Other Bank' }));
            const other = await accountsData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: inst.id,
                    name: 'Other',
                    category: AccountCategory.Asset,
                    group: AccountGroup.Cash,
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
});
