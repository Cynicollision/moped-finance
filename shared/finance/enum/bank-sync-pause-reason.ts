/** Why syncing is paused (SYNC-1.3). Backs a CHECK constraint on `simplefin.access`. */
export enum BankSyncPauseReason {
    /** Bridge refused the access URL (403): revoked, so it needs a new setup token. */
    Refused = 'refused',
    /** Bridge says the subscription needs payment (402); once paid, Try again resumes syncing. */
    Payment = 'payment',
    /** The stored access URL can't be decrypted, because `ENCRYPTION_KEY` changed. */
    Undecryptable = 'undecryptable'
}
