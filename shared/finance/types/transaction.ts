import { Entity } from './../../core/types/entity-base';

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
