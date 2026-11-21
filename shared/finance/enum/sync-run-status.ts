/** How a sync went (SYNC-3.7). Backs a CHECK constraint on `simplefin.sync_runs`. */
export enum SyncRunStatus {
    Running = 'running',
    Succeeded = 'succeeded',
    Failed = 'failed',
    /** A scheduled sync that would have gone over the limit (SYNC-3.4). */
    Skipped = 'skipped'
}
