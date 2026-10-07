import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { AccountCategory, AccountGroup, AccountType, TransactionsSortKey } from '@shared/finance/enum';
import { SortDirection } from '@shared/core/enum';
import { DailyBalance, TotalValueHistory } from '@shared/finance/contracts';
import { Account, BalanceHistory } from '@shared/finance/types';
import { DatabaseClient, FinanceEntityFactory } from '@server/data';
import { IAppLogger } from '@server/logging';
import { DateTimeUtil } from '@server/utility';
import { TestExpressUtil, TestDatabaseUtil } from '@server/utility/testing';
import { FinanceAccountData } from './account-data';
import { createAccountRouter } from './account-routes';
import { FinanceBalanceHistoryData } from './balance-history-data';
import { FinanceTransactionData } from './../transactions/transaction-data';
import { FinanceInstitutionData } from './../institutions/institution-data';

describe('Account Routes', () => {
    let app: express.Express;
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let accountData: FinanceAccountData;
    let balanceHistoryData: FinanceBalanceHistoryData;
    let transactionsData: FinanceTransactionData;
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

    function insertAccount(name = 'Checking') {
        return accountData.insert(
            FinanceEntityFactory.createAccount({
                institutionId: testInstitutionId,
                name,
                type: AccountType.Checking
            })
        );
    }

    function importBalances(accountId: string, csv: string, query = ''): request.Test {
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
        it('INST-1.1 should return every account', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    hideFromSpending: false
                })
            );
            const acc2 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Savings',
                    type: AccountType.Savings,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    hideFromSpending: false
                })
            );

            const response = await request(app).get('/accounts');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map((a: any) => a.id)).toEqual(expect.arrayContaining([acc1.id, acc2.id]));
        });

        it('ACCT-2.1 should give each account its latest balance on or before asOfDate, or 0 if it has none', async () => {
            const account = await insertAccount();
            await balanceHistoryData.insertBulk([
                FinanceEntityFactory.createBalanceHistory({ accountId: account.id, date: '2026-05-01', balance: 100 }),
                FinanceEntityFactory.createBalanceHistory({ accountId: account.id, date: '2026-05-20', balance: 200 })
            ]);

            const balanceOn = async (asOfDate: string) =>
                (await request(app).get(`/accounts?asOfDate=${asOfDate}`)).body[0].balance;

            expect(await balanceOn('2026-04-30')).toBe(0);
            expect(await balanceOn('2026-05-19')).toBe(100);
            expect(await balanceOn('2026-05-20')).toBe(200);
        });

        it('ACCT-2.1 should leave out entries after today when no asOfDate is sent', async () => {
            DateTimeUtil.setClock(new Date('2026-05-17T12:00:00Z'));
            const account = await insertAccount();
            await balanceHistoryData.insertBulk([
                FinanceEntityFactory.createBalanceHistory({ accountId: account.id, date: '2026-05-01', balance: 100 }),
                FinanceEntityFactory.createBalanceHistory({ accountId: account.id, date: '2026-05-20', balance: 200 })
            ]);

            const list = await request(app).get('/accounts');
            const single = await request(app).get(`/accounts/${account.id}`);

            expect(list.body[0].balance).toBe(100);
            expect(single.body.balance).toBe(100);
        });

        it('DASH-2.1 should sort accounts by name, ignoring case', async () => {
            for (const name of ['savings', 'Checking', 'brokerage']) {
                await insertAccount(name);
            }

            const response = await request(app).get('/accounts');

            expect(response.body.map((a: Account) => a.name)).toEqual(['brokerage', 'Checking', 'savings']);
        });
    });

    describe('GET /accounts/total-value-history', () => {
        it('DASH-2.6 should return net worth as total assets less the size of total liabilities', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    hideFromSpending: false
                })
            );
            const loan = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Mortgage',
                    type: AccountType.Mortgage
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
                },
                FinanceEntityFactory.createBalanceHistory({
                    accountId: loan.id,
                    balance: -1000,
                    date: DateTimeUtil.today()
                })
            ];
            await balanceHistoryData.insertBulk(balanceHistory);

            const response = await request(app).get(
                '/accounts/total-value-history?type=NetWorth&timeframe=PastThirtyDays'
            );

            expect(response.status).toBe(200);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0].amount).toBe(1500.0);
        });

        it('DASH-1.2 should default to the past thirty days up to today', async () => {
            DateTimeUtil.setClock(new Date('2026-06-01T16:00:00Z'));
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
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
            const dates = response.body.map((v: TotalValueHistory) => v.date);
            expect([dates[0], dates[dates.length - 1], dates.length]).toEqual(['2026-05-02', '2026-06-01', 31]);
        });

        it('APP-5.7 should return 400 when type is missing', async () => {
            const response = await request(app).get('/accounts/total-value-history');
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('type:');
        });

        it('APP-5.7 should return 400 when timeframe is invalid', async () => {
            const response = await request(app).get(
                '/accounts/total-value-history?type=NetWorth&timeframe=InvalidValue'
            );
            expect(response.status).toBe(400);
            expect(response.body.message).toContain('timeframe:');
        });
    });

    describe('GET /accounts/:accountId', () => {
        it('ACCT-2.6 should return a single account when found', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    hideFromSpending: false
                })
            );

            const response = await request(app).get(`/accounts/${acc1.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(acc1.id);
            expect(response.body.name).toBe('Checking');
        });

        it('ACCT-2.6 should return 404 when account is not found', async () => {
            const response = await request(app).get('/accounts/missing');

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });

        it('ACCT-2.6 should give the date of the current balance, or null when there is none', async () => {
            const account = await insertAccount();
            const before = await request(app).get(`/accounts/${account.id}?asOfDate=2026-05-17`);
            await balanceHistoryData.insertBulk([
                FinanceEntityFactory.createBalanceHistory({ accountId: account.id, date: '2026-05-01', balance: 100 }),
                FinanceEntityFactory.createBalanceHistory({ accountId: account.id, date: '2026-05-20', balance: 200 })
            ]);

            const after = await request(app).get(`/accounts/${account.id}?asOfDate=2026-05-17`);

            expect(before.body.balanceDate).toBeNull();
            expect(after.body.balanceDate).toBe('2026-05-01');
        });

        it('ACCT-2.1 should give the balance as of asOfDate', async () => {
            const account = await insertAccount();
            await balanceHistoryData.insertBulk([
                FinanceEntityFactory.createBalanceHistory({ accountId: account.id, date: '2026-05-01', balance: 100 }),
                FinanceEntityFactory.createBalanceHistory({ accountId: account.id, date: '2026-05-20', balance: 200 })
            ]);

            const response = await request(app).get(`/accounts/${account.id}?asOfDate=2026-05-17`);

            expect(response.body.balance).toBe(100);
        });
    });

    describe('POST /accounts', () => {
        it('ACCT-1.3 should create a new account', async () => {
            const payload = {
                name: 'New Account',
                institutionId: testInstitutionId,
                type: AccountType.Checking,
                isHidden: false,
                isManual: true,
                hideFromSpending: false
            };

            const response = await request(app).post('/accounts').send(payload);

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('New Account');
            expect(response.body.group).toBe(AccountGroup.Cash);
            expect(response.body.category).toBe(AccountCategory.Asset);

            const account = await accountData.retrieveSingle(response.body.id);
            expect(account).not.toBeNull();
            expect(account?.name).toBe('New Account');
        });

        it('ACCT-1.11 should refuse an account with no type', async () => {
            const payload = { name: 'New Account', institutionId: testInstitutionId };

            const response = await request(app).post('/accounts').send(payload);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('type:');
        });

        it("ACCT-1.11 should refuse a type that isn't one of the account types", async () => {
            const payload = { name: 'New Account', institutionId: testInstitutionId, type: 'Crypto' };

            const response = await request(app).post('/accounts').send(payload);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('type:');
        });

        it('ACCT-1.11 should take the group and Asset or Liability from the type, ignoring any sent', async () => {
            const payload = {
                name: 'Card',
                institutionId: testInstitutionId,
                type: AccountType.CreditCard,
                group: AccountGroup.Cash,
                category: AccountCategory.Asset
            };

            const response = await request(app).post('/accounts').send(payload);

            expect(response.status).toBe(201);
            expect(response.body.group).toBe(AccountGroup.CreditCards);
            expect(response.body.category).toBe(AccountCategory.Liability);
        });
    });

    describe('PUT /accounts/:accountId', () => {
        it('ACCT-1.5 should update an account when input is valid', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Old Checking',
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
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

        it('ACCT-1.5 should return 404 when update fails because resource does not exist', async () => {
            const payload = {
                name: 'Updated Checking',
                institutionId: testInstitutionId,
                type: AccountType.Checking,
                isHidden: false,
                isManual: true,
                hideFromSpending: false
            };

            const response = await request(app).put('/accounts/missing-acc').send(payload);

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });
    });

    describe('DELETE /accounts/:accountId', () => {
        it('ACCT-1.6 should delete an account with its balance history and transactions', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    hideFromSpending: false
                })
            );
            await importBalances(acc1.id!, 'Date,Balance\n2026-06-01,1');
            const transaction = await transactionsData.insert(
                FinanceEntityFactory.createTransaction({
                    accountId: acc1.id,
                    categoryId: testCategoryId,
                    date: '2026-06-01',
                    amount: 1,
                    merchant: 'Store',
                    originalStatement: '',
                    notes: '',
                    isHidden: false,
                    isSplit: false,
                    splitParentId: ''
                })
            );

            const response = await request(app).delete(`/accounts/${acc1.id}`);

            expect(response.status).toBe(204);

            const deletedAccount = await accountData.retrieveSingle(acc1.id!);
            expect(deletedAccount).toBeNull();
            expect(await balancesFor(acc1.id!)).toEqual([]);
            expect(await transactionsData.retrieveSingle(transaction.id!)).toBeNull();
        });

        it('ACCT-1.6 should return 404 when delete fails because resource does not exist', async () => {
            const response = await request(app).delete('/accounts/missing-acc');

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });
    });

    describe('GET /accounts/:accountId/balance-history', () => {
        it('ACCT-2.4 should default to the past thirty days up to today', async () => {
            DateTimeUtil.setClock(new Date('2026-06-01T16:00:00Z'));
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking Account',
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    hideFromSpending: false
                })
            );
            await balanceHistoryData.insertBulk(
                ['2026-05-01', '2026-05-02', '2026-06-01', '2026-06-02'].map(date =>
                    FinanceEntityFactory.createBalanceHistory({ accountId: acc1.id, balance: 500, date })
                )
            );

            const response = await request(app).get(`/accounts/${acc1.id}/balance-history`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(31);
            expect(response.body[0]).toEqual({ date: '2026-05-02', balance: 500 });
            expect(response.body[30]).toEqual({ date: '2026-06-01', balance: 500 });
        });

        it('ACCT-2.4 should return every day from 30 days before asOfDate through asOfDate, dated YYYY-MM-DD', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking Account',
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
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
            const dates = response.body.map((b: DailyBalance) => b.date);
            expect(dates[0]).toBe('2026-05-02');
            expect(dates[dates.length - 1]).toBe('2026-06-01');
            expect(dates.length).toBe(31);
        });

        it('ACCT-2.11 should carry each entry forward to the next, starting at the first entry', async () => {
            const account = await insertAccount();
            await balanceHistoryData.insertBulk([
                FinanceEntityFactory.createBalanceHistory({ accountId: account.id, balance: 100, date: '2026-05-10' }),
                FinanceEntityFactory.createBalanceHistory({ accountId: account.id, balance: 200, date: '2026-05-13' })
            ]);

            const response = await request(app)
                .get(`/accounts/${account.id}/balance-history`)
                .query({ timeframe: 'PastThirtyDays', asOfDate: '2026-05-15' });

            expect(response.body).toEqual([
                { date: '2026-05-10', balance: 100 },
                { date: '2026-05-11', balance: 100 },
                { date: '2026-05-12', balance: 100 },
                { date: '2026-05-13', balance: 200 },
                { date: '2026-05-14', balance: 200 },
                { date: '2026-05-15', balance: 200 }
            ]);
        });

        it('ACCT-2.11 should carry an entry from before the timeframe into its first day', async () => {
            const account = await insertAccount();
            await balanceHistoryData.insertBulk([
                FinanceEntityFactory.createBalanceHistory({ accountId: account.id, balance: 100, date: '2026-01-01' })
            ]);

            const response = await request(app)
                .get(`/accounts/${account.id}/balance-history`)
                .query({ timeframe: 'PastThirtyDays', asOfDate: '2026-05-15' });

            expect(response.body.length).toBe(31);
            expect(response.body[0]).toEqual({ date: '2026-04-15', balance: 100 });
        });

        it('ACCT-2.5 should return no days for an account with no entries', async () => {
            const account = await insertAccount();

            const response = await request(app)
                .get(`/accounts/${account.id}/balance-history`)
                .query({ timeframe: 'All', asOfDate: '2026-05-15' });

            expect(response.body).toEqual([]);
        });

        it('DASH-1.2 should total balances for each day of the timeframe, oldest first, dated YYYY-MM-DD', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    type: AccountType.Checking
                })
            );
            const acc2 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Savings',
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
                { date: '2026-05-31', amount: 100, type: 'Assets' },
                { date: '2026-06-01', amount: 150, type: 'Assets' }
            ]);
        });

        it('DASH-1.4 DASH-1.7 should carry each account forward, so accounts updated on different days add up', async () => {
            const a = await insertAccount('A');
            const b = await insertAccount('B');
            await balanceHistoryData.insertBulk([
                FinanceEntityFactory.createBalanceHistory({ accountId: a.id, balance: 100, date: '2026-06-01' }),
                FinanceEntityFactory.createBalanceHistory({ accountId: b.id, balance: 50, date: '2026-06-03' }),
                FinanceEntityFactory.createBalanceHistory({ accountId: a.id, balance: 300, date: '2026-06-05' })
            ]);

            const history = await request(app).get(
                '/accounts/total-value-history?type=NetWorth&timeframe=PastThirtyDays&asOfDate=2026-06-06'
            );
            const accounts = await request(app).get('/accounts?asOfDate=2026-06-06');

            expect(history.body.map((d: TotalValueHistory) => [d.date, d.amount])).toEqual([
                ['2026-06-01', 100],
                ['2026-06-02', 100],
                ['2026-06-03', 150],
                ['2026-06-04', 150],
                ['2026-06-05', 350],
                ['2026-06-06', 350]
            ]);
            // The chart's point for today is the sum of the accounts' current balances.
            const total = accounts.body.reduce((sum: number, account: Account) => sum + account.balance!, 0);
            expect(history.body[history.body.length - 1].amount).toBe(total);
        });

        it('DASH-1.1 should total assets or liabilities by their type', async () => {
            const types = [AccountType.Vehicle, AccountType.RothIRA, AccountType.CreditCard, AccountType.AutoLoan];
            for (const [i, type] of types.entries()) {
                const account = await accountData.insert(
                    FinanceEntityFactory.createAccount({ institutionId: testInstitutionId, name: type, type })
                );
                await balanceHistoryData.insertBulk([
                    FinanceEntityFactory.createBalanceHistory({
                        accountId: account.id,
                        balance: account.category === AccountCategory.Asset ? 10 ** i : -(10 ** i),
                        date: '2026-06-01'
                    })
                ]);
            }
            const total = async (type: string) =>
                (await request(app).get(`/accounts/total-value-history?type=${type}&asOfDate=2026-06-01`)).body[0]
                    .amount;

            expect(await total('Assets')).toBe(11);
            expect(await total('Liabilities')).toBe(-1100);
            expect(await total('NetWorth')).toBe(-1089);
        });

        it('APP-5.7 should return 400 when timeframe is invalid', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking Account',
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
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
        function insertTransaction(accountId: string, date: string, merchant = 'Store') {
            return transactionsData.insert(
                FinanceEntityFactory.createTransaction({
                    accountId,
                    categoryId: testCategoryId,
                    date,
                    amount: 50.0,
                    merchant,
                    originalStatement: '',
                    notes: '',
                    isHidden: false,
                    isSplit: false,
                    splitParentId: ''
                })
            );
        }

        it("ACCT-2.7 should return only the account's own transactions", async () => {
            const acc1 = await insertAccount('Checking');
            const acc2 = await insertAccount('Savings');
            await insertTransaction(acc1.id, DateTimeUtil.today());
            await insertTransaction(acc2.id, DateTimeUtil.today(), 'Elsewhere');

            const response = await request(app).get(`/accounts/${acc1.id}/transactions`);

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(1);
            expect(response.body[0].amount).toBe(50.0);
            expect(response.body[0].merchant).toBe('Store');
        });

        it('ACCT-2.7 should return the most recent transactions first, up to the limit', async () => {
            const acc1 = await insertAccount();
            for (const date of ['2026-06-01', '2026-06-03', '2026-06-02']) {
                await insertTransaction(acc1.id, date);
            }

            const response = await request(app).get(`/accounts/${acc1.id}/transactions`).query({
                sortKey: TransactionsSortKey.Date,
                sortDirection: SortDirection.Desc,
                limit: '2'
            });

            expect(response.status).toBe(200);
            expect(response.body.map((t: { date: string }) => t.date)).toEqual(['2026-06-03', '2026-06-02']);
        });
    });

    describe('GET /:accountId/export-balances', () => {
        it('ACCT-3.1 should return a CSV file named after the account', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
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
            expect(response.header['content-disposition']).toMatch(
                /filename="Balances_Checking_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2}\.csv"/
            );
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
        it('ACCT-3.5 should process a CSV file and return import statistics', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
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

        it('ACCT-3.3 should perform a dry run without saving when dryRun=true', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
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

        it('ACCT-3.4 should report a missing Date or Balance by row', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
                    hideFromSpending: false
                })
            );

            const csvContent = 'Date,Balance,AccountName\n,100,Checking\n2026-06-06,,Checking';

            const response = await request(app)
                .post(`/accounts/${acc1.id}/import-balances?dryRun=true`)
                .attach('file', Buffer.from(csvContent), 'import.csv');

            expect(response.status).toBe(200);
            expect(response.body.failedRowMessages).toEqual([
                'Row 2: Date is required.',
                'Row 3: Balance is required.'
            ]);
            expect(response.body.createdCount).toBe(0);
        });

        it('ACCT-3.9 should reject a second balance for the same date', async () => {
            const acc1 = await accountData.insert(
                FinanceEntityFactory.createAccount({
                    institutionId: testInstitutionId,
                    name: 'Checking',
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
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

        it('APP-8.1 should reject a date after today, allowing a day for time zones', async () => {
            DateTimeUtil.setClock(new Date('2026-05-17T12:00:00Z'));
            const account = await insertAccount();

            const response = await importBalances(
                account.id,
                'Date,Balance\n2026-05-18,1\n2026-05-19,2',
                '?dryRun=true'
            );

            expect(response.body.failedRowMessages).toEqual(['Row 3: Date 2026-05-19 is after today.']);
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
                    type: AccountType.Checking,
                    balance: 1000.0,
                    isHidden: false,
                    isManual: false,
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

        it('ACCT-1.11 should refuse to clear the type', async () => {
            const account = await insertAccount();

            const response = await request(app).put(`/accounts/${account.id}`).send({ type: null });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('type:');
        });

        it("ACCT-1.5 should move an account to its new type's group", async () => {
            const account = await insertAccount();

            const response = await request(app).put(`/accounts/${account.id}`).send({ type: AccountType.Vehicle });

            expect(response.status).toBe(200);
            expect(response.body.type).toBe(AccountType.Vehicle);
            expect(response.body.group).toBe(AccountGroup.OtherAssets);
        });

        it('APP-5.5 should reject an account whose institution does not exist', async () => {
            const payload = {
                institutionId: 'missing',
                name: 'X',
                type: AccountType.Checking
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
