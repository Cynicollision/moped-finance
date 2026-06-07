import { CalendarPeriod } from './../../core/enum';
import { Entity } from './../../core/types';
import { BudgetStreamType } from './../enum/budget-stream-type';

export type BudgetStream = Entity & {
    userId: string;
    type: BudgetStreamType;
    name: string;
    categoryId: string;
    recurrence: CalendarPeriod;
    amount: number;
};