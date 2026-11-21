/** What started a sync (SYNC-3.7). Backs a CHECK constraint on `simplefin.sync_runs`. */
export enum SyncTrigger {
    /** The four daily syncs (SYNC-3.1). */
    Scheduled = 'scheduled',
    /** Sync now, or Try again (SYNC-3.3, SYNC-1.3). */
    Manual = 'manual',
    /** The first sync after connecting (SYNC-1.1). */
    Connect = 'connect'
}
