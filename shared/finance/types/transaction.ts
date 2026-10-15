import { CalendarDate, Entity } from './../../core/types';

export type Transaction = Entity & {
    accountId: string;
    categoryId: string;
    date: CalendarDate;
    amount: number;
    merchant: string;
    originalStatement: string;
    notes: string;
    isHidden: boolean;
    /** Whether it changes its account's balance history (ACCT-5.2). A hidden one doesn't, until it's shown (TXN-2.10). */
    adjustsBalance: boolean;
    /**
     * Shared by the parts of a split transaction, each of which is a transaction of its own (TXN-4); '' when it isn't
     * split.
     */
    splitId: string;
};

/** One part of a split, as the split dialog sends it. Without an `id` it's a new part. */
export interface TransactionSplitPart {
    id?: string;
    /** Signed like the transaction's amount (APP-6.3), and in the same direction. */
    amount: number;
    categoryId: string;
    merchant: string;
    notes: string;
}

/**
 * Splits a transaction, or changes the parts of a split one, keeping those with an `id` and removing the rest (TXN-4.1,
 * TXN-4.5).
 */
export interface SplitTransactionRequest {
    parts: TransactionSplitPart[];
}
