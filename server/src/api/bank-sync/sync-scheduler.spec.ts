import { randomBytes } from 'crypto';
import { PGlite } from '@electric-sql/pglite';
import { BankSyncPauseReason, SyncRunStatus, SyncTrigger } from '@shared/finance/enum';
import { DatabaseClient } from '@server/data';
import { DateTimeUtil, SecretBox } from '@server/utility';
import { TestDatabaseUtil } from '@server/utility/testing';
import { SettingsData } from './../settings/settings-data';
import { FakeSimplefinClient } from './fake';
import { SimplefinData } from './simplefin-data';
import { CATCH_UP_DELAY_MS } from './sync-schedule';
import { PAYLOAD_RETENTION_MS, SyncScheduler } from './sync-scheduler';
import { SyncRunner } from './sync-runner';

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

describe('SyncScheduler', () => {
    let pglite: PGlite;
    let dbClient: DatabaseClient;
    let data: SimplefinData;
    let settings: SettingsData;
    let runner: SyncRunner;
    let scheduler: SyncScheduler;
    const secretBox = new SecretBox(randomBytes(32));
    const client = new FakeSimplefinClient({ timeoutMs: 50 });

    beforeAll(async () => {
        const mockDb = await TestDatabaseUtil.createMockDatabase();
        pglite = mockDb.pglite;
        dbClient = mockDb.dbClient;
        data = new SimplefinData(dbClient);
        settings = new SettingsData(dbClient);
        runner = new SyncRunner(data, client, secretBox);
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    beforeEach(async () => {
        await TestDatabaseUtil.clearBankSyncData(pglite);
        await TestDatabaseUtil.clearCoreData(pglite);
        // 10:00 in New York, where the tests run.
        DateTimeUtil.setClock(new Date('2026-11-21T15:00:00Z'));
        scheduler = new SyncScheduler(data, settings, runner);
    });

    afterEach(() => {
        scheduler.stop();
        DateTimeUtil.resetClock();
    });

    const later = (ms: number) => DateTimeUtil.setClock(DateTimeUtil.addMilliseconds(DateTimeUtil.now(), ms));

    /** Connects as Bank Sync does, without its first sync, with the first slot at 5:17. */
    async function connect(): Promise<void> {
        const accessUrl = await client.claim('fake');
        await data.saveAccess(secretBox.seal(accessUrl), DateTimeUtil.now());
        await pglite.query('UPDATE simplefin.access SET schedule_minute = $1', [5 * 60 + 17]);
    }

    const scheduledRuns = async () => (await data.retrieveRuns(50)).filter(r => r.trigger === SyncTrigger.Scheduled);

    it('SYNC-3.1 should plan nothing before connecting', async () => {
        expect(await scheduler.wake()).toBeNull();
    });

    it('SYNC-3.1 should plan the next slot, and sync on it as a scheduled sync', async () => {
        await connect();

        const planned = await scheduler.wake();
        expect(planned).toEqual({ at: new Date(2026, 10, 21, 11, 17), slot: new Date(2026, 10, 21, 11, 17) });

        DateTimeUtil.setClock(planned!.at);
        const outcome = await scheduler.runSlot(planned!.slot);

        expect(outcome).toMatchObject({ kind: 'ran', run: { status: SyncRunStatus.Succeeded } });
        expect(await scheduledRuns()).toHaveLength(1);
        expect((await scheduler.wake())!.slot).toEqual(new Date(2026, 10, 21, 17, 17));
    });

    it('SYNC-3.1 should not sync with Automatic sync off, nor catch up that slot', async () => {
        await connect();
        await settings.update({ bankSyncAutomatic: false });
        DateTimeUtil.setClock(new Date(2026, 10, 21, 11, 17));

        expect(await scheduler.runSlot(new Date(2026, 10, 21, 11, 17))).toBeNull();
        expect(await data.retrieveRuns(10)).toHaveLength(0);

        later(minute);
        await settings.update({ bankSyncAutomatic: true });
        expect((await scheduler.wake())!.slot).toEqual(new Date(2026, 10, 21, 17, 17));
    });

    it('SYNC-1.3 should not sync on a slot while paused', async () => {
        await connect();
        await data.setPausedReason(BankSyncPauseReason.Refused);

        const outcome = await scheduler.runSlot(new Date(2026, 10, 21, 11, 17));

        expect(outcome).toEqual({ kind: 'paused', reason: BankSyncPauseReason.Refused });
        expect(await data.retrieveRuns(10)).toHaveLength(0);
    });

    it('SYNC-3.4 should record a skipped sync on a slot at the limit, without asking Bridge', async () => {
        await connect();
        for (let i = 0; i < 20; i++) {
            await runner.run(SyncTrigger.Manual);
            later(minute);
        }

        const outcome = await scheduler.runSlot(new Date(2026, 10, 21, 11, 17));

        expect(outcome).toMatchObject({ kind: 'ran', run: { status: SyncRunStatus.Skipped } });
        expect((await data.requestTimesSince(new Date(0))).length).toBe(20);
    });

    it('SYNC-3.2 should catch up a slot missed while the server was down, and only once across restarts', async () => {
        await connect();
        // The server was down from before 11:17 until 12:00.
        DateTimeUtil.setClock(new Date(2026, 10, 21, 12, 0));

        const planned = await scheduler.wake();
        expect(planned).toEqual({
            at: new Date(new Date(2026, 10, 21, 12, 0).getTime() + CATCH_UP_DELAY_MS),
            slot: new Date(2026, 10, 21, 11, 17)
        });
        DateTimeUtil.setClock(planned!.at);
        await scheduler.runSlot(planned!.slot);

        // Restarted: a new scheduler knows only what the database says.
        later(minute);
        const restarted = new SyncScheduler(data, settings, runner);
        expect((await restarted.wake())!.slot).toEqual(new Date(2026, 10, 21, 17, 17));
        expect(await scheduledRuns()).toHaveLength(1);
    });

    it('SYNC-2.10 should clear payloads older than 30 days, except the latest successful one', async () => {
        await connect();
        DateTimeUtil.setClock(DateTimeUtil.addMilliseconds(DateTimeUtil.now(), -40 * day));
        await runner.run(SyncTrigger.Manual);
        later(5 * day);
        await runner.run(SyncTrigger.Manual);
        const responses = async () =>
            (
                await pglite.query<{ has: boolean }>(
                    'SELECT response IS NOT NULL AS has FROM simplefin.sync_runs ORDER BY started_at'
                )
            ).rows.map(row => row.has);
        DateTimeUtil.setClock(new Date('2026-11-21T15:00:00Z'));

        // Both are older than 30 days; the later one is what linking reads.
        expect(await scheduler.prune()).toBe(1);
        expect(await responses()).toEqual([false, true]);

        await runner.run(SyncTrigger.Manual);
        expect(await scheduler.prune()).toBe(1);
        expect(await responses()).toEqual([false, false, true]);

        // A payload within the 30 days stays.
        later(PAYLOAD_RETENTION_MS - minute);
        await runner.run(SyncTrigger.Manual);
        expect(await scheduler.prune()).toBe(0);
        expect(await responses()).toEqual([false, false, true, true]);
    });
});
