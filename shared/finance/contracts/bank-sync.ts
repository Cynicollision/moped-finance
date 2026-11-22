import { CalendarDate } from './../../core/types';
import { AccountType, BankAccountAction, BankSyncPauseReason } from './../enum';
import { BankAccount } from './../types';

/** `POST /api/v1/bank-sync/connect` (SYNC-1.1, and Connect again, SYNC-1.3). */
export interface ConnectBankSyncRequest {
    setupToken: string;
}

/** `PUT /api/v1/bank-sync/accounts/:id`: link, create, Don't sync or unlink (SYNC-2). */
export type BankAccountRequest =
    | {
          action: BankAccountAction.Link;
          accountId: string;
          /** Defaults as `BankAccountLinkDefaults` says (SYNC-2.4). */
          syncFrom?: CalendarDate;
      }
    | {
          action: BankAccountAction.Create;
          name: string;
          type: AccountType;
          /** An existing institution, or `institutionName` for a new one (SYNC-2.3). */
          institutionId?: string;
          institutionName?: string;
          isHidden?: boolean;
      }
    | { action: BankAccountAction.Ignore }
    | { action: BankAccountAction.Unlink };

/** What a bank account action did. */
export interface BankAccountResult {
    bankAccount: BankAccount;
    /** Transactions linking or creating added from the latest sync (SYNC-2.10). */
    transactionsAdded: number;
}

/** `GET /api/v1/bank-sync/accounts/:id/link-defaults?accountId=`: what Link to an account suggests (SYNC-2.4). */
export interface BankAccountLinkDefaults {
    /** The day after the account's latest transaction; for one without, the bank's earliest; failing both, today. */
    syncFrom: CalendarDate;
}

/**
 * SimpleFIN Bridge allows about 24 account requests a day; the server keeps under this many, which is cautious for any
 * other SimpleFIN server too (SYNC-3.4).
 */
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
            'Syncing is paused because your SimpleFIN server refused the connection. Connect again with a new setup token.',
        [BankSyncPauseReason.Payment]:
            "Your SimpleFIN server says your subscription needs payment. Once it's paid, choose Try again.",
        [BankSyncPauseReason.Undecryptable]:
            "Syncing is paused because the stored connection can't be decrypted: ENCRYPTION_KEY has changed. Connect again with a new setup token."
    } satisfies Record<BankSyncPauseReason, string>,
    /** SYNC-2.6: a bank account that can't be linked. */
    notUsd: 'Only accounts in US dollars can be synced.',
    /** SYNC-2.5. */
    bankAccountLinked: 'That bank account is already linked to another account.',
    accountLinked: 'This account is already linked to a bank account.'
};
