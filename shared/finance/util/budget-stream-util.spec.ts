import { CalendarPeriod } from './../../core/enum';
import { BudgetStreamType } from './../enum/budget-stream-type';
import { CategoryType } from './../enum/category-type';
import { BudgetStreamUtil } from './budget-stream-util';

describe('BudgetStreamUtil', () => {
    it("BUD-1.1 should take a stream's type from its category's class", () => {
        expect(BudgetStreamUtil.typeOf(CategoryType.Income)).toBe(BudgetStreamType.Income);
        expect(BudgetStreamUtil.typeOf(CategoryType.Expense)).toBe(BudgetStreamType.Expense);
        expect(BudgetStreamUtil.typeOf(CategoryType.Transfer)).toBe(BudgetStreamType.Savings);
    });

    it('BUD-1.6 should convert a stream to a monthly amount', () => {
        expect(BudgetStreamUtil.monthlyAmount({ amount: 100, recurrence: CalendarPeriod.Monthly })).toBe(100);
        expect(BudgetStreamUtil.monthlyAmount({ amount: 300, recurrence: CalendarPeriod.Quarterly })).toBe(100);
        expect(BudgetStreamUtil.monthlyAmount({ amount: 1200, recurrence: CalendarPeriod.Yearly })).toBe(100);
    });
});
