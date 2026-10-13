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
    isSplit: boolean;
    splitParentId: string;
};
