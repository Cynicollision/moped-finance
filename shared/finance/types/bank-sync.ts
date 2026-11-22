import { CalendarDate } from './../../core/types';
import { BankAccountLinkStatus, BankSyncAlertKind, BankSyncPauseReason, SyncRunStatus, SyncTrigger } from './../enum';

/** Bank Sync's state (SYNC-1, SYNC-3). The access URL itself never leaves the server. */
export interface BankSyncStatus {
    /** False when `ENCRYPTION_KEY` isn't set, so bank sync is unavailable (SYNC-1.2). */
    keyConfigured: boolean;
    connected: boolean;
    /** When the current setup token was claimed. */
    connectedAt: Date | null;
    /** The SimpleFIN server's host (no credentials), for "Connected to *host*"; null if not connected or unreadable. */
    host: string | null;
    pausedReason: BankSyncPauseReason | null;
    isRunning: boolean;
    lastRun: SyncRun | null;
    quota: BankSyncQuota;
    /** The `bankSyncAutomatic` setting: whether the four daily syncs run (SYNC-3.1). */
    automatic: boolean;
    /** The next of the four daily slots, while connected, not paused and with Automatic sync on (SYNC-3.1). */
    nextScheduledAt: Date | null;
    /** What the banner says, most serious first; empty when it doesn't show (SYNC-5.1). */
    alerts: BankSyncAlert[];
}

/** One line of Bank Sync's banner (SYNC-5.1). */
export type BankSyncAlert =
    | { kind: BankSyncAlertKind.Paused; reason: BankSyncPauseReason }
    /** The last sync that wasn't skipped failed, for a reason other than a pause. */
    | { kind: BankSyncAlertKind.Failed; failure: string }
    /** A message from the SimpleFIN server in the latest sync, as it wrote it (SYNC-5.2). */
    | { kind: BankSyncAlertKind.Message; text: string }
    /** No sync has succeeded for 48 hours: since the latest success, or since connecting. */
    | { kind: BankSyncAlertKind.NoRecentSync; since: Date }
    /** US dollar bank accounts not set up yet (SYNC-2.2). */
    | { kind: BankSyncAlertKind.NewBankAccounts; count: number };

/** Requests to Bridge left in the last 24 hours (SYNC-3.4). */
export interface BankSyncQuota {
    limit: number;
    remaining: number;
    /** When the next request frees up; null while some remain. */
    availableAt: Date | null;
}

/** One sync (SYNC-3.7). */
export interface SyncRun {
    id: string;
    trigger: SyncTrigger;
    status: SyncRunStatus;
    startedAt: Date;
    finishedAt: Date | null;
    /** Connected accounts whose transactions and balance it updated. */
    accountsUpdated: number;
    transactionsAdded: number;
    transactionsUpdated: number;
    /** Why it failed or was skipped, in our words. */
    failure: string | null;
    /** What Bridge said, as it wrote it (SYNC-5.2). */
    messages: BankSyncMessage[];
}

/** A message from Bridge (SYNC-5.2). */
export interface BankSyncMessage {
    /** Bridge's code (`gen.*`, `con.*`, `act.*`), when it gave one. */
    code: string | null;
    text: string;
    /** SimpleFIN's IDs of the connection and bank account it's about, when it says. */
    connectionId: string | null;
    accountId: string | null;
}

/** A bank account from the latest sync (SYNC-2.1). */
export interface BankAccount {
    id: string;
    connectionId: string;
    connectionName: string;
    name: string;
    /** An ISO 4217 code, or a URL for a custom currency. */
    currency: string;
    /** Only US dollar accounts can be linked (SYNC-2.6). */
    canLink: boolean;
    balance: number;
    availableBalance: number | null;
    balanceDate: Date;
    linkStatus: BankAccountLinkStatus;
    linkedAccount: { id: string; name: string } | null;
    /** Set while syncs don't return it (SYNC-2.9): when the first one that didn't ran. */
    missingSince: Date | null;
    /** When the latest successful sync that returned it finished (ACCT-2.6, ACCT-7.3). */
    lastSyncedAt: Date | null;
    /** The first day a linked bank account takes transactions from (SYNC-2.4); null unless linked. */
    syncFrom: CalendarDate | null;
}
