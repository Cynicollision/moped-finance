import { randomBytes } from 'crypto';
import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { CalendarDateUtil } from '@shared/core/util';
import {
    BankAccountAction,
    BankAccountLinkStatus,
    BankSyncPauseReason,
    SyncRunStatus,
    SyncTrigger
} from '@shared/finance/enum';
import { AccountType } from '@shared/finance/enum';
import { BankAccount, BankSyncStatus, SyncRun } from '@shared/finance/types';
import { DatabaseClient, EntityFactory } from '@server/data';
import { DateTimeUtil, SecretBox } from '@server/utility';
import { TestDatabaseUtil, TestExpressUtil } from '@server/utility/testing';
import { AccountData } from './../accounts/account-data';
import { InstitutionData } from './../institutions/institution-data';
import { TransactionData } from './../transactions/transaction-data';
import { BankAccountLinkData } from './bank-account-link-data';
import { BankSyncController, BankSyncMessages } from './bank-sync-controller';
import { createBankSyncRouter } from './bank-sync-routes';
import { fakeAccountIds, fakeChangeDelaySeconds, FakeSimplefinClient } from './fake';
import { ISimplefinClient, SimplefinError, SimplefinErrorKind } from './simplefin-client';
import { SimplefinData } from './simplefin-data';
import { SimplefinAccountSet } from './simplefin-response';
import { SyncRunner } from './sync-runner';
import { SyncTransform } from './sync-transform';

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;
// 10:00 in New York, where the tests run.
const morning = new Date('2026-11-21T15:00:00Z');

/**
 * The fake Bridge, with switches: `failWith` makes the next fetches fail as Bridge would, and `hold` keeps a fetch
 * waiting until it's released, to have a sync running.
 */
class TestClient implements ISimplefinClient {
    private readonly fake = new FakeSimplefinClient({ timeoutMs: 50 });
    public failWith: SimplefinErrorKind | Error | null = null;
    public claimFailure: SimplefinErrorKind | null = null;
    public claims = 0;
    public fetches: { accessUrl: string; startDate: Date }[] = [];
    public accessUrls: string[] = [];
    private held: { entered: () => void; release: Promise<void> } | null = null;

    public async claim(setupToken: string): Promise<string> {
        this.claims++;
        if (this.claimFailure) {
            throw new SimplefinError(this.claimFailure, 'Claim failed.');
        }
        const accessUrl = await this.fake.claim(setupToken);
        this.accessUrls.push(accessUrl);
        return accessUrl;
    }

    public async fetchAccounts(accessUrl: string, startDate: Date): Promise<SimplefinAccountSet> {
        this.fetches.push({ accessUrl, startDate });
        if (this.held) {
            const { entered, release } = this.held;
            entered();
            await release;
        }
        if (this.failWith instanceof Error) {
            throw this.failWith;
        }
        if (this.failWith) {
            throw new SimplefinError(this.failWith, `Bridge failed: ${this.failWith}.`);
        }
        return this.fake.fetchAccounts(accessUrl, startDate);
    }

    /** Holds the next fetches; resolves `entered` once one is waiting. */
    public hold(): { entered: Promise<void>; release: () => void } {
        let entered!: () => void;
        let release!: () => void;
        const enteredPromise = new Promise<void>(resolve => (entered = resolve));
        const releasePromise = new Promise<void>(resolve => (release = resolve));
        this.held = { entered, release: releasePromise };
        return {
            entered: enteredPromise,
            release: () => {
                this.held = null;
                release();
            }
        };
    }
}

describe('Bank Sync Routes', () => {
    let pglite: PGlite;
    let dbClient: DatabaseClient;
    let data: SimplefinData;
    let secretBox: SecretBox;
    let client: TestClient;
    let logger: ReturnType<typeof TestExpressUtil.createMockLogger>;
    let app: express.Express;

    function buildApp(box: SecretBox | undefined): express.Express {
        const controller = new BankSyncController(
            data,
            client,
            box,
            new BankAccountLinkData(dbClient),
            new AccountData(dbClient)
        );
        return TestExpressUtil.createTestApp(createBankSyncRouter(logger, controller), '/bank-sync');
    }

    beforeAll(async () => {
        const mockDb = await TestDatabaseUtil.createMockDatabase();
        pglite = mockDb.pglite;
        dbClient = mockDb.dbClient;
        data = new SimplefinData(dbClient);
        secretBox = new SecretBox(randomBytes(32));
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    beforeEach(async () => {
        await TestDatabaseUtil.clearBankSyncData(pglite);
        await TestDatabaseUtil.clearFinanceData(pglite);
        DateTimeUtil.setClock(morning);
        client = new TestClient();
        logger = TestExpressUtil.createMockLogger();
        app = buildApp(secretBox);
    });

    const status = async (): Promise<BankSyncStatus> => (await request(app).get('/bank-sync')).body;
    const bankAccounts = async (): Promise<BankAccount[]> => (await request(app).get('/bank-sync/accounts')).body;
    const connect = (setupToken = 'fake') => request(app).post('/bank-sync/connect').send({ setupToken });
    const syncNow = () => request(app).post('/bank-sync/sync');
    const later = (ms: number) => DateTimeUtil.setClock(DateTimeUtil.addMilliseconds(DateTimeUtil.now(), ms));

    async function linkTo(simplefinId: string): Promise<string> {
        const institution = await new InstitutionData(dbClient).insert(
            EntityFactory.createInstitution({ name: 'Harbor Community Bank' })
        );
        const account = await new AccountData(dbClient).insert(
            EntityFactory.createAccount({ institutionId: institution.id, name: 'Savings', type: AccountType.Savings })
        );
        await pglite.query('UPDATE simplefin.accounts SET linked_account_id = $1 WHERE simplefin_id = $2', [
            account.id,
            simplefinId
        ]);
        return account.id;
    }

    describe('GET /bank-sync', () => {
        it('SYNC-1.2 should say whether the encryption key is set', async () => {
            expect(await status()).toMatchObject({ keyConfigured: true, connected: false, lastRun: null });

            app = buildApp(undefined);
            expect(await status()).toMatchObject({ keyConfigured: false, connected: false });
        });

        it('SYNC-3.4 should report the whole limit before any request', async () => {
            expect((await status()).quota).toEqual({ limit: 20, remaining: 20, availableAt: null });
        });
    });

    describe('POST /bank-sync/connect', () => {
        it('SYNC-1.1 should claim the token, store the access URL sealed, and run the first sync', async () => {
            const response = await connect();

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                connected: true,
                pausedReason: null,
                isRunning: false,
                lastRun: { trigger: SyncTrigger.Connect, status: SyncRunStatus.Succeeded, failure: null },
                quota: { remaining: 19 }
            });

            const stored = await pglite.query<{ access_url: string; schedule_minute: number }>(
                'SELECT access_url, schedule_minute FROM simplefin.access'
            );
            expect(stored.rows).toHaveLength(1);
            expect(stored.rows[0].access_url).toMatch(/^v1\./);
            expect(secretBox.open(stored.rows[0].access_url)).toBe(client.accessUrls[0]);
            expect(stored.rows[0].schedule_minute).toBeGreaterThanOrEqual(0);
            expect(stored.rows[0].schedule_minute).toBeLessThan(360);
        });

        it('SYNC-1.1 SYNC-3.6 should ask Bridge for the last 44 days', async () => {
            await connect();

            expect(client.fetches).toHaveLength(1);
            expect(client.fetches[0].startDate).toEqual(DateTimeUtil.addMilliseconds(morning, -44 * day));
        });

        it('SYNC-1.1 should reject a token Bridge refuses, with its message, and store nothing', async () => {
            client.claimFailure = 'refused';

            const response = await connect();

            expect(response.status).toBe(400);
            expect(response.body.message).toBe(BankSyncMessages.tokenRefused);
            expect((await status()).connected).toBe(false);
        });

        it('SYNC-1.1 should reject what is not a setup token', async () => {
            const response = await connect('fake:no-such-scenario');

            expect(response.status).toBe(400);
            expect(response.body.message).toBe(BankSyncMessages.tokenInvalid);
        });

        it('SYNC-1.1 should refuse a missing setup token', async () => {
            const response = await request(app).post('/bank-sync/connect').send({ setupToken: '  ' });

            expect(response.status).toBe(400);
            expect(client.claims).toBe(0);
        });

        it('SYNC-1.2 should refuse to connect without an encryption key, and not claim the token', async () => {
            app = buildApp(undefined);

            const response = await connect();

            expect(response.status).toBe(400);
            expect(response.body.message).toBe(BankSyncMessages.noKey);
            expect(client.claims).toBe(0);
        });
    });

    describe('GET /bank-sync/accounts', () => {
        it('SYNC-2.1 SYNC-2.2 SYNC-2.6 should list every bank account with its connection, Not set up', async () => {
            await connect();

            const accounts = await bankAccounts();

            expect(accounts.map(a => [a.connectionName, a.name, a.currency, a.canLink, a.linkStatus])).toEqual([
                ['Harbor Community Bank', 'Everyday Checking', 'USD', true, BankAccountLinkStatus.NotSetUp],
                ['Harbor Community Bank', 'High-Yield Savings', 'USD', true, BankAccountLinkStatus.NotSetUp],
                ['Harbor Community Bank', 'Holiday Fund', 'USD', true, BankAccountLinkStatus.NotSetUp],
                ['Lakeside Home Loans', 'Mortgage', 'USD', true, BankAccountLinkStatus.NotSetUp],
                ['Maple Leaf Trust', 'Chequing', 'CAD', false, BankAccountLinkStatus.NotSetUp],
                ['Summit Credit Union', 'Rewards Visa', 'USD', true, BankAccountLinkStatus.NotSetUp]
            ]);
            expect(accounts.every(a => a.missingSince === null && a.linkedAccount === null)).toBe(true);
            expect(typeof accounts[0].balance).toBe('number');
        });

        it('SYNC-2.1 should return none before connecting', async () => {
            expect(await bankAccounts()).toEqual([]);
        });

        it('SYNC-2.1 should show what a bank account is linked to', async () => {
            await connect();
            const accountId = await linkTo(fakeAccountIds.savings);

            const savings = (await bankAccounts()).find(a => a.name === 'High-Yield Savings')!;

            expect(savings.linkStatus).toBe(BankAccountLinkStatus.Linked);
            expect(savings.linkedAccount).toEqual({ id: accountId, name: 'Savings' });
        });

        it('SYNC-2.2 should add a bank account that appears later as Not set up', async () => {
            await connect('fake:new-account');
            later(fakeChangeDelaySeconds * 1000);

            await syncNow();

            const certificate = (await bankAccounts()).find(a => a.name === 'Share Certificate');
            expect(certificate?.linkStatus).toBe(BankAccountLinkStatus.NotSetUp);
        });

        it('SYNC-2.9 should mark a linked bank account the sync no longer returns as missing, and keep its link', async () => {
            await connect('fake:missing');
            const accountId = await linkTo(fakeAccountIds.savings);
            later(fakeChangeDelaySeconds * 1000);
            const secondSync = DateTimeUtil.now();

            await syncNow();
            later(hour);
            await syncNow();

            const savings = (await bankAccounts()).find(a => a.name === 'High-Yield Savings')!;
            expect(new Date(savings.missingSince!)).toEqual(secondSync);
            expect(savings.linkedAccount?.id).toBe(accountId);
        });

        it('SYNC-2.9 should drop a bank account that is not set up when the sync no longer returns it', async () => {
            await connect('fake:missing');
            later(fakeChangeDelaySeconds * 1000);

            await syncNow();

            expect((await bankAccounts()).map(a => a.name)).not.toContain('High-Yield Savings');
        });

        it('SYNC-2.9 should clear missing once the bank account is returned again', async () => {
            await connect();
            await linkTo(fakeAccountIds.savings);
            await pglite.query("UPDATE simplefin.accounts SET missing_since = now() WHERE name = 'High-Yield Savings'");

            await syncNow();

            const savings = (await bankAccounts()).find(a => a.name === 'High-Yield Savings')!;
            expect(savings.missingSince).toBeNull();
        });
    });

    describe('POST /bank-sync/sync', () => {
        it('SYNC-3.3 should sync now and return the run', async () => {
            await connect();
            later(hour);

            const response = await syncNow();

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                trigger: SyncTrigger.Manual,
                status: SyncRunStatus.Succeeded,
                transactionsAdded: 0,
                failure: null,
                messages: []
            });
        });

        it('SYNC-1.1 should refuse to sync before connecting', async () => {
            const response = await syncNow();

            expect(response.status).toBe(400);
            expect(response.body.message).toBe(BankSyncMessages.notConnected);
        });

        it('SYNC-4.7 should store the payload with pending transactions, and add nothing to the accounts', async () => {
            await connect('fake:pending');

            const runs = await pglite.query<{ response: SimplefinAccountSet }>(
                'SELECT response FROM simplefin.sync_runs'
            );
            const transactions = runs.rows[0].response.accounts.flatMap(a => a.transactions);
            expect(transactions.some(t => t.pending)).toBe(true);
            expect((await pglite.query('SELECT id FROM finance.transactions')).rows).toEqual([]);
        });

        it('SYNC-5.2 should keep what Bridge said on the run', async () => {
            await connect('fake:attention');

            const run = (await status()).lastRun!;
            expect(run.messages).toEqual([
                expect.objectContaining({ code: 'con.auth', connectionId: 'CON-SUMMIT', text: expect.any(String) })
            ]);
        });

        it('SYNC-3.3 should record a failed request, and leave syncing on', async () => {
            await connect();
            client.failWith = 'timeout';

            const response = await syncNow();

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({ status: SyncRunStatus.Failed, failure: 'Bridge failed: timeout.' });
            expect((await status()).pausedReason).toBeNull();
        });

        it('SYNC-3.5 should free the lock when something unexpected stops a sync', async () => {
            await connect();
            client.failWith = new Error('Something else broke');
            later(minute);

            expect((await syncNow()).status).toBe(500);
            client.failWith = null;
            later(minute);

            const response = await syncNow();
            expect(response.status).toBe(200);
            const runs: SyncRun[] = (await request(app).get('/bank-sync/runs')).body;
            expect(runs[1]).toMatchObject({
                status: SyncRunStatus.Failed,
                failure: 'An unexpected error stopped this sync.'
            });
        });
    });

    describe('SYNC-1.3 pausing', () => {
        it('SYNC-1.3 should pause when Bridge refuses the access URL, and resume on Connect again, keeping links', async () => {
            await connect();
            const accountId = await linkTo(fakeAccountIds.savings);
            client.failWith = 'refused';
            later(hour);

            await syncNow();

            expect(await status()).toMatchObject({
                connected: true,
                pausedReason: BankSyncPauseReason.Refused,
                lastRun: { status: SyncRunStatus.Failed }
            });
            const refused = await syncNow();
            expect(refused.status).toBe(400);
            expect(refused.body.message).toBe(BankSyncMessages.paused.refused);

            client.failWith = null;
            later(hour);
            const response = await connect();

            expect(response.body).toMatchObject({ pausedReason: null, lastRun: { status: SyncRunStatus.Succeeded } });
            const savings = (await bankAccounts()).find(a => a.name === 'High-Yield Savings')!;
            expect(savings.linkedAccount?.id).toBe(accountId);
        });

        it('SYNC-1.3 should pause when connecting with fake:refused', async () => {
            const response = await connect('fake:refused');

            expect(response.status).toBe(200);
            expect(response.body).toMatchObject({
                connected: true,
                pausedReason: BankSyncPauseReason.Refused,
                lastRun: { trigger: SyncTrigger.Connect, status: SyncRunStatus.Failed }
            });
        });

        it('SYNC-1.3 should pause when connecting with fake:payment', async () => {
            const response = await connect('fake:payment');

            expect(response.body).toMatchObject({ connected: true, pausedReason: BankSyncPauseReason.Payment });
        });

        it('SYNC-1.3 should pause for payment, and resume when Try again succeeds', async () => {
            await connect();
            client.failWith = 'payment-required';
            await syncNow();
            expect((await status()).pausedReason).toBe(BankSyncPauseReason.Payment);

            // Still unpaid: Try again is allowed, and syncing stays paused.
            expect((await syncNow()).body.status).toBe(SyncRunStatus.Failed);
            expect((await status()).pausedReason).toBe(BankSyncPauseReason.Payment);

            // Paid: the same access URL works again, without a new setup token.
            client.failWith = null;
            const response = await syncNow();

            expect(response.body.status).toBe(SyncRunStatus.Succeeded);
            expect((await status()).pausedReason).toBeNull();
            expect(client.claims).toBe(1);
        });

        it('SYNC-1.3 should not sync on schedule while paused for payment', async () => {
            await connect();
            client.failWith = 'payment-required';
            await syncNow();

            const outcome = await new SyncRunner(data, client, secretBox).run(SyncTrigger.Scheduled);

            expect(outcome).toEqual({ kind: 'paused', reason: BankSyncPauseReason.Payment });
        });

        it('SYNC-1.3 should pause when the access URL cannot be decrypted with the current key', async () => {
            await connect();
            app = buildApp(new SecretBox(randomBytes(32)));

            const response = await syncNow();

            expect(response.body).toMatchObject({ status: SyncRunStatus.Failed });
            expect((await status()).pausedReason).toBe(BankSyncPauseReason.Undecryptable);
            expect(client.fetches).toHaveLength(1);
        });
    });

    describe('PUT /bank-sync/accounts/:id', () => {
        let institutionId: string;
        const accountData = () => new AccountData(dbClient);

        beforeEach(async () => {
            const institution = await new InstitutionData(dbClient).insert(
                EntityFactory.createInstitution({ name: 'Harbor Community Bank' })
            );
            institutionId = institution.id!;
        });

        const bankAccountId = async (name: string) => (await bankAccounts()).find(a => a.name === name)!.id;
        const bankAccount = async (id: string) => (await bankAccounts()).find(a => a.id === id)!;
        const update = (id: string, body: object) => request(app).put(`/bank-sync/accounts/${id}`).send(body);
        const link = (id: string, accountId: string, syncFrom?: string) =>
            update(id, { action: BankAccountAction.Link, accountId, syncFrom });
        const linkDefaults = (id: string, accountId: string) =>
            request(app).get(`/bank-sync/accounts/${id}/link-defaults?accountId=${accountId}`);

        async function insertAccount(name = 'Checking') {
            const account = await accountData().insert(
                EntityFactory.createAccount({ institutionId, name, type: AccountType.Checking })
            );
            return account.id;
        }

        async function transactionsOf(accountId: string) {
            const result = await pglite.query<{
                id: string;
                date: string;
                amount: string;
                merchant: string;
                original_statement: string;
                category_id: string | null;
                adjusts_balance: boolean;
            }>(
                `SELECT id, to_char(date, 'YYYY-MM-DD') AS date, amount, merchant, original_statement, category_id,
                        adjusts_balance
                 FROM finance.transactions WHERE account_id = $1 ORDER BY date, id`,
                [accountId]
            );
            return result.rows;
        }

        async function balancesOf(accountId: string): Promise<[string, number][]> {
            const result = await pglite.query<{ date: string; balance: string }>(
                `SELECT to_char(date, 'YYYY-MM-DD') AS date, balance FROM finance.balance_history
                 WHERE account_id = $1 ORDER BY date`,
                [accountId]
            );
            return result.rows.map(row => [row.date, Number(row.balance)]);
        }

        /** The dates of the bank account's posted transactions in the latest sync, oldest first. */
        async function postedDates(simplefinId: string): Promise<string[]> {
            const result = await pglite.query<{ response: SimplefinAccountSet }>(
                `SELECT response FROM simplefin.sync_runs WHERE status = 'succeeded'
                 ORDER BY started_at DESC LIMIT 1`
            );
            const payload = result.rows[0].response.accounts.find(a => a.id === simplefinId)!;
            return SyncTransform.transactions(payload, { from: null, to: DateTimeUtil.latestRecordDate() }).map(
                t => t.date
            );
        }

        it('SYNC-2.4 SYNC-4.1 SYNC-4.2 ACCT-4.3 should link, adding the bank transactions from the chosen day', async () => {
            await connect();
            const accountId = await insertAccount();
            const id = await bankAccountId('Everyday Checking');
            const dates = await postedDates(fakeAccountIds.checking);
            const syncFrom = dates[Math.floor(dates.length / 2)];
            const expected = dates.filter(date => date >= syncFrom).length;
            const fetches = client.fetches.length;

            const response = await link(id, accountId, syncFrom);

            expect(response.status).toBe(200);
            expect(response.body.transactionsAdded).toBe(expected);
            expect(response.body.bankAccount).toMatchObject({
                linkStatus: BankAccountLinkStatus.Linked,
                linkedAccount: { id: accountId, name: 'Checking' },
                syncFrom
            });
            const added = await transactionsOf(accountId);
            expect(added).toHaveLength(expected);
            expect(added.every(t => t.date >= syncFrom && t.category_id === null && !t.adjusts_balance)).toBe(true);
            expect(added.every(t => t.merchant.length > 0 && t.original_statement.length > 0)).toBe(true);
            expect((await accountData().retrieveSingle(accountId))?.isManual).toBe(false);
            // SYNC-2.10: from the latest sync, without asking the SimpleFIN server.
            expect(client.fetches).toHaveLength(fetches);
        });

        it("SYNC-2.4 ACCT-5.5 should start after the account's latest transaction by default, and stop adjusting", async () => {
            await connect();
            const accountId = await insertAccount();
            const id = await bankAccountId('Everyday Checking');
            const dates = await postedDates(fakeAccountIds.checking);
            const latest = dates[dates.length - 10];
            await new TransactionData(dbClient).insert(
                EntityFactory.createTransaction({
                    accountId,
                    categoryId: '',
                    date: latest,
                    amount: -40,
                    merchant: 'Imported',
                    originalStatement: '',
                    notes: '',
                    isHidden: false,
                    adjustsBalance: true
                })
            );
            const balancesBefore = await balancesOf(accountId);
            const dayAfter = CalendarDateUtil.addDays(latest, 1);

            const defaults = await linkDefaults(id, accountId);
            const response = await link(id, accountId);

            expect(defaults.body).toEqual({ syncFrom: dayAfter });
            expect(response.body.bankAccount.syncFrom).toBe(dayAfter);
            expect(response.body.transactionsAdded).toBe(dates.filter(date => date >= dayAfter).length);
            const transactions = await transactionsOf(accountId);
            expect(transactions.filter(t => t.merchant === 'Imported').map(t => t.adjusts_balance)).toEqual([false]);
            expect(transactions.filter(t => t.merchant !== 'Imported').every(t => t.date >= dayAfter)).toBe(true);
            // The entries the imported transaction made stay, and the bank's balance is recorded (ACCT-4.2).
            expect(await balancesOf(accountId)).toEqual(expect.arrayContaining(balancesBefore));
            expect((await accountData().retrieveSingle(accountId))?.balance).toBe((await bankAccount(id)).balance);
        });

        it('SYNC-2.4 should start from the earliest bank transaction for an account without transactions', async () => {
            await connect();
            const accountId = await insertAccount();
            const id = await bankAccountId('Everyday Checking');

            const defaults = await linkDefaults(id, accountId);

            expect(defaults.body).toEqual({ syncFrom: (await postedDates(fakeAccountIds.checking))[0] });
        });

        it('SYNC-4.6 should fill in the history of an account without balances from the bank balance', async () => {
            await connect();
            const accountId = await insertAccount();
            const id = await bankAccountId('Everyday Checking');
            const dates = await postedDates(fakeAccountIds.checking);

            await link(id, accountId);

            const balances = await balancesOf(accountId);
            const bankBalance = (await bankAccount(id)).balance;
            expect(balances[0][0]).toBe(CalendarDateUtil.addDays(dates[0], -1));
            expect(balances[balances.length - 1][1]).toBe(bankBalance);
            expect((await accountData().retrieveSingle(accountId))?.balance).toBe(bankBalance);
            // Each day's balance is the one before plus that day's transactions.
            const transactions = await transactionsOf(accountId);
            for (let i = 1; i < balances.length; i++) {
                const [date, balance] = balances[i];
                const dayTotal = transactions
                    .filter(t => t.date === date)
                    .reduce((sum, t) => sum + Number(t.amount), 0);
                expect(balance).toBeCloseTo(balances[i - 1][1] + dayTotal, 2);
            }
        });

        it('SYNC-2.7 SYNC-4.1 should unlink, keeping the history, and add nothing twice when linked again', async () => {
            await connect();
            const accountId = await insertAccount();
            const id = await bankAccountId('Everyday Checking');
            const first = await link(id, accountId);
            const count = (await transactionsOf(accountId)).length;

            const unlinked = await update(id, { action: BankAccountAction.Unlink });

            expect(unlinked.status).toBe(200);
            expect(unlinked.body.bankAccount).toMatchObject({
                linkStatus: BankAccountLinkStatus.NotSetUp,
                linkedAccount: null,
                syncFrom: null
            });
            expect((await accountData().retrieveSingle(accountId))?.isManual).toBe(true);
            expect(await transactionsOf(accountId)).toHaveLength(count);

            const again = await link(id, accountId, (await postedDates(fakeAccountIds.checking))[0]);

            expect(first.body.transactionsAdded).toBe(count);
            expect(again.body.transactionsAdded).toBe(0);
            expect(await transactionsOf(accountId)).toHaveLength(count);
        });

        it('TXN-2.12 should not add a synced transaction the user deleted again', async () => {
            await connect();
            const accountId = await insertAccount();
            const id = await bankAccountId('Everyday Checking');
            await link(id, accountId);
            const [deleted] = await transactionsOf(accountId);
            await new TransactionData(dbClient).delete(deleted.id);
            await update(id, { action: BankAccountAction.Unlink });

            const again = await link(id, accountId, (await postedDates(fakeAccountIds.checking))[0]);

            expect(again.body.transactionsAdded).toBe(0);
        });

        it('SYNC-4.1 should add transactions added to another account before to the account linked now', async () => {
            await connect();
            const firstId = await insertAccount('First');
            const secondId = await insertAccount('Second');
            const id = await bankAccountId('Everyday Checking');
            const first = await link(id, firstId);
            await update(id, { action: BankAccountAction.Unlink });

            const second = await link(id, secondId);

            expect(second.body.transactionsAdded).toBe(first.body.transactionsAdded);
            expect(await transactionsOf(firstId)).toHaveLength(first.body.transactionsAdded);
        });

        it('SYNC-2.3 SYNC-4.6 should create a connected account with everything the bank returned', async () => {
            await connect();
            const id = await bankAccountId('Holiday Fund');
            const dates = await postedDates(fakeAccountIds.holidayFund);

            const response = await update(id, {
                action: BankAccountAction.Create,
                name: 'Holiday Fund',
                type: AccountType.Savings,
                institutionName: 'harbor community bank',
                isHidden: true
            });

            expect(response.status).toBe(200);
            const accountId = response.body.bankAccount.linkedAccount.id;
            const account = await accountData().retrieveSingle(accountId);
            expect(account).toMatchObject({
                name: 'Holiday Fund',
                type: AccountType.Savings,
                institutionId,
                isHidden: true,
                isManual: false
            });
            expect(response.body.transactionsAdded).toBe(dates.length);
            expect(response.body.bankAccount.syncFrom).toBe(dates[0]);
            expect(account?.balance).toBe((await bankAccount(id)).balance);
            expect((await balancesOf(accountId))[0][0]).toBe(CalendarDateUtil.addDays(dates[0], -1));
        });

        it('SYNC-2.3 should create the institution when none has the name', async () => {
            await connect();

            const response = await update(await bankAccountId('Rewards Visa'), {
                action: BankAccountAction.Create,
                name: 'Rewards Visa',
                type: AccountType.CreditCard,
                institutionName: 'Summit Credit Union'
            });

            expect(response.status).toBe(200);
            const account = await accountData().retrieveSingle(response.body.bankAccount.linkedAccount.id);
            const institution = await new InstitutionData(dbClient).retrieveSingle(account!.institutionId);
            expect(institution?.name).toBe('Summit Credit Union');
            expect(account?.isHidden).toBe(false);
        });

        it('SYNC-2.3 should refuse an account without a type or an institution, creating nothing', async () => {
            await connect();
            const id = await bankAccountId('Holiday Fund');
            const create = (fields: object) =>
                update(id, { action: BankAccountAction.Create, name: 'Fund', ...fields });

            const noType = await create({ institutionId });
            const noInstitution = await create({ type: AccountType.Savings });
            const missing = await create({ type: AccountType.Savings, institutionId: 'no-such-institution' });

            expect([noType.status, noInstitution.status, missing.status]).toEqual([400, 400, 400]);
            expect(missing.body.message).toBe('Institution not found.');
            expect((await bankAccount(id)).linkStatus).toBe(BankAccountLinkStatus.NotSetUp);
            expect(await accountData().retrieveAll()).toEqual([]);
        });

        it('SYNC-2.5 should refuse a bank account linked to another account, and an account linked to another', async () => {
            await connect();
            const checkingId = await insertAccount('Checking');
            const otherId = await insertAccount('Other');
            const checking = await bankAccountId('Everyday Checking');
            const savings = await bankAccountId('High-Yield Savings');
            await link(checking, checkingId);

            const bankAccountTaken = await link(checking, otherId);
            const accountTaken = await link(savings, checkingId);

            expect(bankAccountTaken.status).toBe(400);
            expect(bankAccountTaken.body.message).toBe(BankSyncMessages.bankAccountLinked);
            expect(accountTaken.status).toBe(400);
            expect(accountTaken.body.message).toBe(BankSyncMessages.accountLinked);
            expect(await transactionsOf(otherId)).toEqual([]);
            expect((await bankAccount(savings)).linkStatus).toBe(BankAccountLinkStatus.NotSetUp);
        });

        it('SYNC-2.6 should refuse to link a bank account not in US dollars', async () => {
            await connect();

            const response = await link(await bankAccountId('Chequing'), await insertAccount());

            expect(response.status).toBe(400);
            expect(response.body.message).toBe(BankSyncMessages.notUsd);
        });

        it('SYNC-2.4 should refuse a closed account, a missing one and a missing bank account', async () => {
            await connect();
            const id = await bankAccountId('Everyday Checking');
            const closedId = await insertAccount();
            await accountData().close(closedId, '2026-11-01');

            const closed = await link(id, closedId);
            const missing = await link(id, 'no-such-account');
            const missingBankAccount = await link('no-such-bank-account', closedId);

            expect(closed.body.message).toBe(BankSyncMessages.accountClosed);
            expect(missing.body.message).toBe(BankSyncMessages.accountNotFound);
            expect(missingBankAccount.status).toBe(404);
        });

        it("SYNC-2.2 should remember Don't sync, which unlinks a linked bank account", async () => {
            await connect();
            const accountId = await insertAccount();
            const id = await bankAccountId('Everyday Checking');
            await link(id, accountId);

            const ignored = await update(id, { action: BankAccountAction.Ignore });
            await syncNow();

            expect(ignored.body.bankAccount).toMatchObject({
                linkStatus: BankAccountLinkStatus.Ignored,
                linkedAccount: null
            });
            expect((await bankAccount(id)).linkStatus).toBe(BankAccountLinkStatus.Ignored);
            expect((await accountData().retrieveSingle(accountId))?.isManual).toBe(true);

            const notSetUp = await update(id, { action: BankAccountAction.Unlink });
            expect(notSetUp.body.bankAccount.linkStatus).toBe(BankAccountLinkStatus.NotSetUp);
        });

        it('SYNC-2.8 should unlink an account that is closed, and not link it again when reopened', async () => {
            await connect();
            const accountId = await insertAccount();
            const id = await bankAccountId('Everyday Checking');
            await link(id, accountId);

            await accountData().close(accountId, DateTimeUtil.today());
            await accountData().reopen(accountId);

            expect((await bankAccount(id)).linkStatus).toBe(BankAccountLinkStatus.NotSetUp);
            expect((await accountData().retrieveSingle(accountId))?.isManual).toBe(true);
        });

        it('SYNC-2.8 should unlink a deleted account, so its bank account can bring the transactions elsewhere', async () => {
            await connect();
            const deletedId = await insertAccount('Old');
            const id = await bankAccountId('Everyday Checking');
            const first = await link(id, deletedId);

            await accountData().delete(deletedId);
            const newId = await insertAccount('New');
            const again = await link(id, newId);

            expect(again.status).toBe(200);
            expect(again.body.transactionsAdded).toBe(first.body.transactionsAdded);
        });

        it('ACCT-2.6 ACCT-7.3 should say when a bank account last synced', async () => {
            await connect();
            later(hour);
            await syncNow();

            expect(new Date((await bankAccount(await bankAccountId('Everyday Checking'))).lastSyncedAt!)).toEqual(
                DateTimeUtil.now()
            );
        });

        it('SYNC-3.5 should refuse to link while a sync is running', async () => {
            await connect();
            const accountId = await insertAccount();
            const id = await bankAccountId('Everyday Checking');
            const held = client.hold();
            const running = syncNow().then(response => response);
            await held.entered;

            const response = await link(id, accountId);

            held.release();
            await running;
            expect(response.status).toBe(409);
            expect(await transactionsOf(accountId)).toEqual([]);
        });
    });

    describe('DELETE /bank-sync', () => {
        it('SYNC-1.4 should delete the access URL, the bank accounts and the payloads, and leave the accounts alone', async () => {
            await connect();
            const accountId = await linkTo(fakeAccountIds.savings);

            const response = await request(app).delete('/bank-sync');

            expect(response.status).toBe(204);
            for (const table of ['access', 'connections', 'accounts']) {
                expect((await pglite.query(`SELECT * FROM simplefin.${table}`)).rows).toEqual([]);
            }
            expect((await pglite.query('SELECT id FROM simplefin.sync_runs WHERE response IS NOT NULL')).rows).toEqual(
                []
            );
            expect(await new AccountData(dbClient).retrieveSingle(accountId)).not.toBeNull();
            expect(await status()).toMatchObject({ connected: false, pausedReason: null });
        });

        it('SYNC-1.4 SYNC-3.4 should keep counting requests made before disconnecting', async () => {
            await connect();
            await request(app).delete('/bank-sync');

            expect((await status()).quota.remaining).toBe(19);
        });

        it('SYNC-1.4 should return 404 when not connected', async () => {
            expect((await request(app).delete('/bank-sync')).status).toBe(404);
        });
    });

    describe('SYNC-3.4 the limit', () => {
        it('SYNC-3.4 should refuse the 21st request in 24 hours, and allow it once the first is 24 hours old', async () => {
            await connect();
            for (let i = 1; i < 20; i++) {
                later(minute);
                expect((await syncNow()).status).toBe(200);
            }
            later(minute);

            const refused = await syncNow();

            expect(refused.status).toBe(429);
            expect(refused.body.message).toBe(BankSyncMessages.overLimit(DateTimeUtil.addMilliseconds(morning, day)));
            expect(refused.body.message).toMatch(/Available again at 10:00 AM\.$/);
            expect(client.fetches).toHaveLength(20);
            expect((await status()).quota).toEqual({
                limit: 20,
                remaining: 0,
                availableAt: DateTimeUtil.addMilliseconds(morning, day).toISOString()
            });
            expect((await request(app).get('/bank-sync/runs')).body).toHaveLength(10);

            DateTimeUtil.setClock(DateTimeUtil.addMilliseconds(morning, day));
            expect((await syncNow()).status).toBe(200);
            expect(client.fetches).toHaveLength(21);
        });

        it('SYNC-3.4 should count failed requests', async () => {
            await connect();
            client.failWith = 'timeout';
            for (let i = 1; i < 20; i++) {
                await syncNow();
            }

            expect((await syncNow()).status).toBe(429);
        });

        it('SYNC-3.4 should refuse to connect at the limit without claiming the token', async () => {
            await connect();
            for (let i = 1; i < 20; i++) {
                await syncNow();
            }
            client.claims = 0;

            const response = await connect();

            expect(response.status).toBe(429);
            expect(client.claims).toBe(0);
        });

        it('SYNC-3.4 should skip a scheduled sync at the limit, recording it without asking Bridge', async () => {
            await connect();
            for (let i = 1; i < 20; i++) {
                await syncNow();
            }

            const outcome = await new SyncRunner(data, client, secretBox).run(SyncTrigger.Scheduled);

            expect(outcome).toMatchObject({ kind: 'ran', run: { status: SyncRunStatus.Skipped } });
            expect(client.fetches).toHaveLength(20);
            expect((await status()).quota.remaining).toBe(0);
        });
    });

    describe('SYNC-3.5 one sync at a time', () => {
        it('SYNC-3.5 should refuse a sync, a connect and a disconnect while one is running', async () => {
            await connect();
            const held = client.hold();
            const first = syncNow().then(response => response);
            await held.entered;

            const second = await syncNow();
            expect(second.status).toBe(409);
            expect(second.body.message).toBe(BankSyncMessages.running);
            expect((await connect()).status).toBe(409);
            expect((await request(app).delete('/bank-sync')).status).toBe(409);
            expect((await status()).isRunning).toBe(true);

            held.release();
            expect((await first).status).toBe(200);
            expect((await syncNow()).status).toBe(200);
        });

        it('SYNC-3.5 should fail the runs a stopped server left running, freeing the lock', async () => {
            await connect();
            await pglite.query(
                "INSERT INTO simplefin.sync_runs (id, trigger, status, started_at) VALUES ('stuck', 'manual', 'running', now())"
            );
            expect((await syncNow()).status).toBe(409);

            expect(await data.failInterruptedRuns()).toBe(1);

            expect((await syncNow()).status).toBe(200);
        });
    });

    describe('GET /bank-sync/runs', () => {
        it('SYNC-3.7 should list the last 10 runs, newest first', async () => {
            await connect();
            for (let i = 0; i < 11; i++) {
                later(minute);
                await syncNow();
            }

            const runs: SyncRun[] = (await request(app).get('/bank-sync/runs')).body;

            expect(runs).toHaveLength(10);
            expect(runs.every(run => run.trigger === SyncTrigger.Manual)).toBe(true);
            const started = runs.map(run => new Date(run.startedAt).getTime());
            expect(started).toEqual([...started].sort((a, b) => b - a));
            expect(runs[0]).not.toHaveProperty('response');
        });
    });

    describe('SYNC-1.1 the access URL stays on the server', () => {
        it('SYNC-1.1 should never put the access URL in a response, a log entry or a stored run', async () => {
            const bodies: string[] = [];
            const record = (response: request.Response) => bodies.push(response.text);

            record(await connect());
            record(await syncNow());
            client.failWith = 'refused';
            record(await syncNow());
            record(await syncNow());
            client.failWith = null;
            record(await connect('fake:payment'));
            record(await syncNow());
            record(await connect());
            record(await request(app).get('/bank-sync'));
            record(await request(app).get('/bank-sync/accounts'));
            record(await request(app).get('/bank-sync/runs'));

            const runs = await pglite.query('SELECT * FROM simplefin.sync_runs');
            // What a log entry holds: the message and the operation's name.
            const logged = [...logger.info.mock.calls, ...logger.warn.mock.calls, ...logger.error.mock.calls]
                .map(([, message, context]) => `${message} ${String(context)}`)
                .join('\n');
            const everything = [...bodies, JSON.stringify(runs.rows), logged].join('\n');

            expect(client.accessUrls).toHaveLength(3);
            for (const accessUrl of client.accessUrls) {
                const { username, password } = new URL(accessUrl);
                expect(everything).not.toContain(accessUrl);
                expect(everything).not.toContain(`${username}:${password}`);
                expect(everything).not.toContain(Buffer.from(`${username}:${password}`).toString('base64'));
                expect(everything).not.toContain(new URL(accessUrl).host);
            }
        });
    });
});
