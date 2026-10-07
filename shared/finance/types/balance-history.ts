import { CalendarDate, Entity } from './../../core/types';
import { BalanceEntrySource } from './../enum';

export type BalanceHistory = Entity & {
    accountId: string;
    balance: number;
    date: CalendarDate;
    source: BalanceEntrySource;
};
