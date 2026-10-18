import { CalendarPeriod } from '@shared/core/enum';
import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';
import { SpendingAverage, SpendingAverageMonths, SpendingTotal } from '@shared/finance/contracts';
import { CategoryType } from '@shared/finance/enum';
import { CategoryFlow } from './transaction-data';

/** How Spending counts what came in and went out (CASH-1.3). */
export class Spending {
    /**
     * Income categories count as income and Expense categories as expenses, each by its net, so refunds reduce
     * spending (CASH-1.9). Transfer categories count as savings by what they moved out of everyday accounts, less what
     * they moved back, and are left out when that's nothing, as a credit card payment's two sides are. Uncategorized
     * money in counts as income and money out as expenses.
     */
    public static totals(flows: CategoryFlow[]): SpendingTotal[] {
        return flows.flatMap((flow): SpendingTotal[] => {
            switch (flow.categoryType) {
                case CategoryType.Income:
                    return [{ categoryId: flow.categoryId, type: CategoryType.Income, amount: net(flow) }];
                case CategoryType.Expense:
                    return [{ categoryId: flow.categoryId, type: CategoryType.Expense, amount: -net(flow) }];
                case CategoryType.Transfer: {
                    const saved = cents(-flow.everydayNet);
                    return saved ? [{ categoryId: flow.categoryId, type: CategoryType.Transfer, amount: saved }] : [];
                }
                default: {
                    const uncategorized: SpendingTotal[] = [];
                    if (flow.moneyIn > 0) {
                        uncategorized.push({ categoryId: '', type: CategoryType.Income, amount: flow.moneyIn });
                    }
                    if (flow.moneyOut > 0) {
                        uncategorized.push({ categoryId: '', type: CategoryType.Expense, amount: flow.moneyOut });
                    }
                    return uncategorized;
                }
            }
        });
    }

    /**
     * The full months before the one `asOfDate` is in: the last `months`, or from the month of the oldest transaction
     * Spending counts when that's more recent, or none when there isn't one before the current month.
     */
    public static averageWindow(
        asOfDate: CalendarDate,
        firstDate: CalendarDate | undefined,
        months: SpendingAverageMonths = 12
    ): AverageWindow {
        const monthStart = (date: CalendarDate) => CalendarDateUtil.getPeriod(CalendarPeriod.Monthly, date).startDate;
        const currentMonth = monthStart(asOfDate);
        const endDate = CalendarDateUtil.addDays(currentMonth, -1);
        if (!firstDate || firstDate > endDate) {
            return { startDate: currentMonth, endDate, months: 0 };
        }

        const monthsBack = CalendarDateUtil.addMonths(currentMonth, -months);
        const firstMonth = monthStart(firstDate);
        const startDate = firstMonth > monthsBack ? firstMonth : monthsBack;
        return { startDate, endDate, months: monthIndex(currentMonth) - monthIndex(startDate) };
    }

    /** The window's totals as an average month: Spending's totals (CASH-1.3) divided by its months, to the cent. */
    public static average(flows: CategoryFlow[], window: AverageWindow): SpendingAverage {
        return {
            ...window,
            totals: Spending.totals(flows).map(total => ({ ...total, amount: cents(total.amount / window.months) }))
        };
    }
}

function monthIndex(date: CalendarDate): number {
    return Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
}

/** The dates an average month is taken over, and how many months they are (BUD-1.8, CASH-1.12). */
export type AverageWindow = Pick<SpendingAverage, 'startDate' | 'endDate' | 'months'>;

// Rounded to the cent, since money in and money out are added up apart.
function net(flow: CategoryFlow): number {
    return cents(flow.moneyIn - flow.moneyOut);
}

// Never -0, which a negated zero would otherwise be.
function cents(amount: number): number {
    return Math.round(amount * 100) / 100 || 0;
}
