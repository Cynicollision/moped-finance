import { CalendarPeriod } from './../../common/enum';
import { Entity } from './../../common/types';
import { BudgetStreamType } from './../enum/budget-stream-type';

export type BudgetStream = Entity & {
    userId: string;
    type: BudgetStreamType;
    name: string;
    categoryId: string;
    recurrence: CalendarPeriod;
    amount: number;
};