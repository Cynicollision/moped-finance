import { randomBytes } from 'crypto';
import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { BankAccountLinkStatus, BankSyncPauseReason, SyncRunStatus, SyncTrigger } from '@shared/finance/enum';
import { AccountType } from '@shared/finance/enum';
import { BankAccount, BankSyncStatus, SyncRun } from '@shared/finance/types';
import { DatabaseClient, EntityFactory } from '@server/data';
import { DateTimeUtil, SecretBox } from '@server/utility';
import { TestDatabaseUtil, TestExpressUtil } from '@server/utility/testing';
import { AccountData } from './../accounts/account-data';
import { InstitutionData } from './../institutions/institution-data';
import { BankSyncController, BankSyncMessages } from './bank-sync-controller';
import { createBankSyncRouter } from './bank-sync-routes';
import { fakeAccountIds, fakeChangeDelaySeconds, FakeSimplefinClient } from './fake';
import { ISimplefinClient, SimplefinError, SimplefinErrorKind } from './simplefin-client';
import { SimplefinData } from './simplefin-data';
import { SimplefinAccountSet } from './simplefin-response';
import { SyncRunner } from './sync-runner';

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
        const controller = new BankSyncController(data, client, box);
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
