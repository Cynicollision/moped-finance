import { Entity } from './../../common/types';

export type Transaction = Entity & {
    accountId: string;
    categoryId: string;
    date: string;
    amount: number;
    merchant: string;
    originalStatement: string;
    notes: string;
    isHidden: boolean;
    isSplit: boolean;
    splitParentId: string;
};
