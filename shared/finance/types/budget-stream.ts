import { Entity } from './../../core/types/entity-base';
import { BudgetStreamRecurrence } from './../enum/budget-stream-recurrence';
import { BudgetStreamType } from './../enum/budget-stream-type';

export type BudgetStream = Entity & {
    userId: string;
    type: BudgetStreamType;
    name: string;
    categoryId: string;
    recurrence: BudgetStreamRecurrence;
    recurrenceMultiple: number;
    amount: number; // TODO: gross/net for income, net only for gross
};