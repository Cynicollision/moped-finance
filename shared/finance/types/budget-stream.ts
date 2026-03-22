import { Entity } from './../../core/types/entity-base';
import { BudgetPeriod } from './../enum/budget-period';
import { BudgetStreamType } from './../enum/budget-stream-type';

export type BudgetStream = Entity & {
    userId: string;
    type: BudgetStreamType;
    name: string;
    categoryId: string;
    recurrence: BudgetPeriod;
    amount: number;
};