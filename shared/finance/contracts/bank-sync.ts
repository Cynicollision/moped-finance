/** `POST /api/v1/bank-sync/connect` (SYNC-1.1, and Connect again, SYNC-1.3). */
export interface ConnectBankSyncRequest {
    setupToken: string;
}

/** Bridge allows about 24 account requests a day; the server keeps under this many (SYNC-3.4). */
export const BANK_SYNC_DAILY_REQUEST_LIMIT = 20;

/** How far back each sync asks for transactions (SYNC-3.6). */
export const BANK_SYNC_WINDOW_DAYS = 44;
