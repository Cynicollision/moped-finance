/** Why Bank Sync's banner shows (SYNC-5.1), most serious first. */
export enum BankSyncAlertKind {
    Paused = 'paused',
    Failed = 'failed',
    Message = 'message',
    NoRecentSync = 'no-recent-sync',
    NewBankAccounts = 'new-bank-accounts'
}
