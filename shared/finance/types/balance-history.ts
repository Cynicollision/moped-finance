import { Entity } from './../../core/types';

export type BalanceHistory = Entity & {
    accountId: string;
    balance: number;
    date: Date;
};