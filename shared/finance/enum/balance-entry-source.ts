/** Where a balance entry came from (ACCT-5.1). */
export enum BalanceEntrySource {
    /** Entered by the user (a starting balance or Edit Account), imported, or synced: a checkpoint. */
    Set = 'set',
    /** Created or changed only by transactions that adjust the balance (ACCT-5.2). */
    Adjusted = 'adjusted'
}
