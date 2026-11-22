import { SyncTrigger } from '@shared/finance/enum';
import { DateTimeUtil } from '@server/utility';
import { ISettingsData } from './../settings/settings-data';
import { ISimplefinData } from './simplefin-data';
import { PlannedSync, SyncSchedule } from './sync-schedule';
import { SyncOutcome, SyncRunner } from './sync-runner';

/** How often to look again while not connected, or after the database failed. */
const recheckMs = 15 * 60_000;

/** How long a run's payload is kept, unless it's the latest successful one (SYNC-2.10). */
export const PAYLOAD_RETENTION_MS = 30 * 24 * 60 * 60_000;

/**
 * The four daily syncs (SYNC-3.1, SYNC-3.2): a timer for the next slot, which syncs unless Automatic sync is off, then
 * sets the next. `SyncRunner` skips a slot while paused or at the limit (SYNC-3.4). It also clears old runs' payloads,
 * when it starts and after each slot. Like `LogRetention`, its timer doesn't keep the process alive, and it never
 * rejects: a failure goes to the console and it looks again later.
 */
export class SyncScheduler {
    private timer: NodeJS.Timeout | undefined;
    private stopped = true;
    private handledSlot: Date | null = null;

    constructor(
        private readonly data: ISimplefinData,
        private readonly settingsData: Pick<ISettingsData, 'retrieve'>,
        private readonly runner: Pick<SyncRunner, 'run'>
    ) {}

    public start(): void {
        this.stop();
        this.stopped = false;
        void this.prune();
        void this.wake();
    }

    public stop(): void {
        this.stopped = true;
        clearTimeout(this.timer);
        this.timer = undefined;
    }

    /** Works out the next sync and sets its timer. Null when not connected, in which case it looks again later. */
    public async wake(): Promise<PlannedSync | null> {
        try {
            const access = await this.data.retrieveAccess();
            if (!access) {
                this.setTimer(recheckMs, () => this.wake());
                return null;
            }
            const plan = SyncSchedule.plan({
                now: DateTimeUtil.now(),
                scheduleMinute: access.scheduleMinute,
                connectedAt: access.claimedAt,
                lastScheduledAt: await this.data.retrieveLastStartedAt(SyncTrigger.Scheduled),
                handledSlot: this.handledSlot
            });
            this.setTimer(plan.at.getTime() - DateTimeUtil.now().getTime(), () => this.fire(plan));
            return plan;
        } catch (error) {
            this.logError('Failed to schedule the next bank sync', error);
            this.setTimer(recheckMs, () => this.wake());
            return null;
        }
    }

    /**
     * The sync for one slot, which counts as dealt with whatever happens. Returns what the runner did, or null when
     * Automatic sync is off or the sync failed to start.
     */
    public async runSlot(slot: Date): Promise<SyncOutcome | null> {
        this.handledSlot = slot;
        try {
            const settings = await this.settingsData.retrieve();
            if (!settings.bankSyncAutomatic) {
                return null;
            }
            return await this.runner.run(SyncTrigger.Scheduled);
        } catch (error) {
            this.logError('Scheduled bank sync failed', error);
            return null;
        }
    }

    /** Clears the payloads of runs older than 30 days, except the latest successful one's. Returns how many. */
    public async prune(): Promise<number> {
        try {
            const cutoff = DateTimeUtil.addMilliseconds(DateTimeUtil.now(), -PAYLOAD_RETENTION_MS);
            return await this.data.pruneResponses(cutoff);
        } catch (error) {
            this.logError('Failed to delete old bank sync payloads', error);
            return 0;
        }
    }

    private async fire(plan: PlannedSync): Promise<void> {
        // A timer can fire a moment early; the slot's run waits for its time.
        const early = plan.at.getTime() - DateTimeUtil.now().getTime();
        if (early > 0) {
            this.setTimer(early, () => this.fire(plan));
            return;
        }
        await this.runSlot(plan.slot);
        await this.prune();
        await this.wake();
    }

    private setTimer(delayMs: number, action: () => Promise<unknown>): void {
        clearTimeout(this.timer);
        if (this.stopped) {
            return;
        }
        this.timer = setTimeout(() => void action(), Math.max(0, delayMs));
        this.timer.unref();
    }

    private logError(what: string, error: unknown): void {
        console.error(`[${DateTimeUtil.getCurrentTimestamp()}] [ERROR] ${what}: ${(error as Error)?.message ?? error}`);
    }
}
