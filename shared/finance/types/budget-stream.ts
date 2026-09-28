import { CalendarPeriod } from './../../core/enum';
import { Entity } from './../../core/types';
import { BudgetStreamType } from './../enum/budget-stream-type';

export type BudgetStream = Entity & {
    /** Follows from the category's class (BUD-1.1); never sent, and not stored. */
    type: BudgetStreamType;
    name: string;
    categoryId: string;
    recurrence: CalendarPeriod;
    amount: number;
};

/** A budget stream as it's written: everything but its type, which comes from the category. */
export type BudgetStreamFields = Omit<BudgetStream, 'type'>;
