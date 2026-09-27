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
    isSplit: boolean;
    splitParentId: string;
};
