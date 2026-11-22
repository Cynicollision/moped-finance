import { BankSyncAlertKind, BankSyncPauseReason, SyncRunStatus } from '@shared/finance/enum';
import { BankSyncAlert, SyncRun } from '@shared/finance/types';

/** How long without a successful sync before the banner says so (SYNC-5.1). */
export const NO_RECENT_SYNC_MS = 48 * 60 * 60_000;

/** What the banner's causes are worked out from. */
export interface BankSyncAlertState {
    now: Date;
    connectedAt: Date;
    pausedReason: BankSyncPauseReason | null;
    automatic: boolean;
    /** The latest finished run that wasn't skipped. */
    lastAttempt: SyncRun | null;
    lastSucceededAt: Date | null;
    newBankAccounts: number;
}

/**
 * SYNC-5.1's banner, for a connection: a line for each cause that holds, most serious first. A failed sync that paused
 * syncing is said by the pause, so it isn't said twice.
 */
export function bankSyncAlerts(state: BankSyncAlertState): BankSyncAlert[] {
    const alerts: BankSyncAlert[] = [];
    if (state.pausedReason) {
        alerts.push({ kind: BankSyncAlertKind.Paused, reason: state.pausedReason });
    }

    const attempt = state.lastAttempt;
    if (attempt?.status === SyncRunStatus.Failed && !state.pausedReason) {
        alerts.push({ kind: BankSyncAlertKind.Failed, failure: attempt.failure ?? 'The last sync failed.' });
    }
    // The SimpleFIN server's words, whatever they're about (SYNC-5.2).
    for (const message of attempt?.messages ?? []) {
        alerts.push({ kind: BankSyncAlertKind.Message, text: message.text });
    }

    if (state.automatic) {
        const since =
            state.lastSucceededAt && state.lastSucceededAt > state.connectedAt
                ? state.lastSucceededAt
                : state.connectedAt;
        if (state.now.getTime() - since.getTime() >= NO_RECENT_SYNC_MS) {
            alerts.push({ kind: BankSyncAlertKind.NoRecentSync, since });
        }
    }

    if (state.newBankAccounts > 0) {
        alerts.push({ kind: BankSyncAlertKind.NewBankAccounts, count: state.newBankAccounts });
    }
    return alerts;
}
