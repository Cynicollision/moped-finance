import { CalendarDate, Entity } from './../../core/types';

export type Transaction = Entity & {
    accountId: string;
    /** Empty when it's Uncategorized (CAT-5), and while it's split, when its parts have the categories (TXN-4). */
    categoryId: string;
    date: CalendarDate;
    amount: number;
    merchant: string;
    originalStatement: string;
    notes: string;
    isHidden: boolean;
    /** Whether it changes its account's balance history (ACCT-5.2). A hidden one doesn't, until it's shown (TXN-2.10). */
    adjustsBalance: boolean;
    /** Its parts, in order, when it's split (TXN-4); empty otherwise. */
    parts: TransactionPart[];
};

/** One part of a split transaction (TXN-4.2). The parts' amounts add up to the transaction's. */
export type TransactionPart = Entity & TransactionPartFields;

export interface TransactionPartFields {
    amount: number;
    /** Empty when the part is Uncategorized. */
    categoryId: string;
    merchant: string;
    notes: string;
}

/** Splits a transaction, or replaces the parts of one that's split (TXN-4.1, TXN-4.5). */
export interface SplitTransactionRequest {
    parts: TransactionPartFields[];
}
