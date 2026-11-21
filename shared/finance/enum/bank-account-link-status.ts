/** What a bank account syncs into (SYNC-2.1). */
export enum BankAccountLinkStatus {
    /** Neither linked nor ignored yet (SYNC-2.2). */
    NotSetUp = 'not-set-up',
    /** Don't sync. */
    Ignored = 'ignored',
    /** Linked to one of the user's accounts. */
    Linked = 'linked'
}
