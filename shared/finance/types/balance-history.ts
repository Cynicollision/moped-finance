import { Entity } from './../../common/types';

export type BalanceHistory = Entity & {
    accountId: string;
    balance: number;
    date: Date;
};