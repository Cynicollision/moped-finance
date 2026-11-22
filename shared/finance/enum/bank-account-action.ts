/** What the user does with a bank account on Bank Sync or Manage Account (SYNC-2). */
export enum BankAccountAction {
    /** Link to an account (SYNC-2.4). */
    Link = 'link',
    /** Create new account (SYNC-2.3). */
    Create = 'create',
    /** Don't sync (SYNC-2.2). */
    Ignore = 'ignore',
    /** Unlink, or undo Don't sync: back to Not set up (SYNC-2.7). */
    Unlink = 'unlink'
}
