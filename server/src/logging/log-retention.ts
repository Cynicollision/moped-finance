import { DateTimeUtil } from '@server/utility';
import { ILogData } from './log-data';

export const DEFAULT_LOG_RETENTION_DAYS = 90;
const minRetentionDays = 7;
const maxRetentionDays = 3650;

const dayMs = 24 * 60 * 60_000;

/**
 * Deletes log entries older than the retention period (APP-5.10), when the server starts and once a day after that,
 * so `core.logs` doesn't grow without bound.
 */
export class LogRetention {
    private timer: NodeJS.Timeout | undefined;

    constructor(
        private logData: ILogData,
        public readonly retentionDays: number = DEFAULT_LOG_RETENTION_DAYS
    ) {}

    /**
     * `LOG_RETENTION_DAYS` if set, otherwise the default. Throws, naming the variable, for a value that isn't a whole
     * number in range, so the server refuses to start.
     */
    public static retentionDaysFromEnvironment(env: NodeJS.ProcessEnv): number {
        const text = env.LOG_RETENTION_DAYS?.trim();
        if (!text) {
            return DEFAULT_LOG_RETENTION_DAYS;
        }
        const value = Number(text);
        if (!/^\d+$/.test(text) || value < minRetentionDays || value > maxRetentionDays) {
            throw new Error(
                `LOG_RETENTION_DAYS must be a whole number from ${minRetentionDays} to ${maxRetentionDays}, not '${text}'.`
            );
        }
        return value;
    }

    /** Prunes now, then once a day until `stop()`. The timer doesn't keep the process alive. */
    public start(): void {
        this.stop();
        void this.prune();
        this.timer = setInterval(() => void this.prune(), dayMs);
        this.timer.unref();
    }

    public stop(): void {
        clearInterval(this.timer);
        this.timer = undefined;
    }

    /**
     * Deletes the entries older than the retention period, returning how many. Never rejects: a failure (the database
     * being down) goes to the console only, since writing it to the log table would likely fail too (APP-5.1).
     */
    public async prune(): Promise<number> {
        const cutoff = DateTimeUtil.addMilliseconds(DateTimeUtil.now(), -this.retentionDays * dayMs);
        try {
            const deleted = await this.logData.deleteOlderThan(cutoff);
            if (deleted > 0) {
                console.info(
                    `[${DateTimeUtil.getCurrentTimestamp()}] [INFO] Deleted ${deleted} log entries older than ${this.retentionDays} days.`
                );
            }
            return deleted;
        } catch (error) {
            console.error(
                `[${DateTimeUtil.getCurrentTimestamp()}] [ERROR] Failed to delete old log entries: ${(error as Error)?.message ?? error}`
            );
            return 0;
        }
    }
}
