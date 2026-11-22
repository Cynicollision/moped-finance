import { BankSyncPauseReason } from './../enum';

/** `POST /api/v1/bank-sync/connect` (SYNC-1.1, and Connect again, SYNC-1.3). */
export interface ConnectBankSyncRequest {
    setupToken: string;
}

/** Bridge allows about 24 account requests a day; the server keeps under this many (SYNC-3.4). */
export const BANK_SYNC_DAILY_REQUEST_LIMIT = 20;

/** How far back each sync asks for transactions (SYNC-3.6). */
export const BANK_SYNC_WINDOW_DAYS = 44;

/** Bank Sync's wording that the server's errors and the page both show, so they read the same. */
export const BankSyncWording = {
    /** SYNC-1.2: without `ENCRYPTION_KEY`, Bank Sync says only this. */
    noKey: 'Bank sync needs an encryption key. Set ENCRYPTION_KEY on the server and restart it.',
    /** SYNC-1.3: why syncing is paused, for each reason. */
    paused: {
        [BankSyncPauseReason.Refused]:
            'Syncing is paused because SimpleFIN Bridge refused the connection. Connect again with a new setup token.',
        [BankSyncPauseReason.Payment]:
            "SimpleFIN Bridge says your subscription needs payment. Once it's paid, choose Try again.",
        [BankSyncPauseReason.Undecryptable]:
            "Syncing is paused because the stored connection can't be decrypted: ENCRYPTION_KEY has changed. Connect again with a new setup token."
    } satisfies Record<BankSyncPauseReason, string>,
    /** SYNC-2.6: a bank account that can't be linked. */
    notUsd: 'Only accounts in US dollars can be synced.'
};
