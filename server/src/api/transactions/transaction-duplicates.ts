import { CalendarDate } from '@shared/core/types';

/** What an import row is matched on when it has no Id: a bank's file has none (TXN-3.12). */
export interface TransactionMatchFields {
    accountId: string;
    date: CalendarDate;
    amount: number;
    originalStatement: string;
}

/** An import row to check: its transaction-to-be, and the Id it had in the file ('' for none). */
export interface TransactionImportRow {
    fileId: string;
    transaction: TransactionMatchFields;
}

function matchKey(fields: TransactionMatchFields): string {
    return [fields.accountId, fields.date, Math.round(fields.amount * 100), fields.originalStatement].join('\u0000');
}

/** Finds the rows of an import that are already in the app, so they aren't created twice (TXN-3.12). */
export class TransactionDuplicates {
    /**
     * The indexes of the rows already imported. A row with an Id is one when that Id is a transaction in the account it
     * goes to; one in another account isn't, so an account's history can be copied to another (ACCT-3.11). A row
     * without an Id is one when a transaction already has its date, account, amount and original statement, each such
     * transaction matching one row only, so two identical purchases in the file against one in the app skip one.
     *
     * @param accountIdsById the account of each transaction whose ID is a row's Id
     * @param existing the transactions to match rows without an Id against: a split counts once, with its total
     */
    public static find(
        rows: TransactionImportRow[],
        accountIdsById: ReadonlyMap<string, string>,
        existing: TransactionMatchFields[]
    ): Set<number> {
        const unmatched = new Map<string, number>();
        for (const transaction of existing) {
            const key = matchKey(transaction);
            unmatched.set(key, (unmatched.get(key) ?? 0) + 1);
        }

        const duplicates = new Set<number>();
        rows.forEach((row, index) => {
            if (row.fileId) {
                if (accountIdsById.get(row.fileId) === row.transaction.accountId) {
                    duplicates.add(index);
                }
                return;
            }
            const key = matchKey(row.transaction);
            const count = unmatched.get(key) ?? 0;
            if (count > 0) {
                unmatched.set(key, count - 1);
                duplicates.add(index);
            }
        });
        return duplicates;
    }
}
