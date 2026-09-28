import { CalendarPeriod } from './../../core/enum';
import { BudgetStreamType } from './../enum/budget-stream-type';
import { CategoryClass } from './../enum/category-class';
import { BudgetStream } from './../types/budget-stream';

const typeByClass: Record<CategoryClass, BudgetStreamType> = {
    [CategoryClass.Income]: BudgetStreamType.Income,
    [CategoryClass.Expense]: BudgetStreamType.Expense,
    [CategoryClass.Transfer]: BudgetStreamType.Savings
};

const monthsPerPeriod: Record<CalendarPeriod, number> = {
    [CalendarPeriod.Monthly]: 1,
    [CalendarPeriod.Quarterly]: 3,
    [CalendarPeriod.Yearly]: 12
};

export class BudgetStreamUtil {

    /** A stream's type follows from its category's class: Income, Expense, or Savings for a Transfer (BUD-1.1). */
    public static typeOf(categoryClass: CategoryClass): BudgetStreamType {
        return typeByClass[categoryClass];
    }

    /** The months in a period: 1, 3 or 12. */
    public static monthsIn(period: CalendarPeriod): number {
        return monthsPerPeriod[period];
    }

    /** What a stream comes to per month: a quarterly amount divided by 3, a yearly one by 12 (BUD-1.6). */
    public static monthlyAmount(stream: Pick<BudgetStream, 'amount' | 'recurrence'>): number {
        return stream.amount / monthsPerPeriod[stream.recurrence];
    }
}
