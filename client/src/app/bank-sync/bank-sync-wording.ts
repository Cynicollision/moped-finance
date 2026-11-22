/** "Bank account linked: 3 transactions added", for linking and creating (SYNC-2.3, SYNC-2.4). */
export function describeLinked(what: string, transactionsAdded: number): string {
    return `${what}: ${transactionsAdded} ${transactionsAdded === 1 ? 'transaction' : 'transactions'} added`;
}

/** SYNC-2.7's and ACCT-4.5's confirmation. */
export function unlinkMessage(accountName: string): string {
    return `Unlink ${accountName}? It becomes manual and keeps its balance history and transactions.`;
}
