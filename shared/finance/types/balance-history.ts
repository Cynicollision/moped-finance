import { Entity } from './../../common/types/entity-base';

export type BalanceHistory = Entity & {
    accountId: string;
    balance: number;
    date: Date;
};