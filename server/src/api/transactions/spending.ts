import { CalendarPeriod } from '@shared/core/enum';
import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';
import { SpendingAverage, SpendingTotal } from '@shared/finance/contracts';
import { CategoryType } from '@shared/finance/enum';
import { CategoryFlow } from './transaction-data';

/** How Spending counts what came in and went out (CASH-1.3). */
export class Spending {
    /**
     * Income categories count as income and Expense categories as expenses, each by its net, so refunds reduce
     * spending (CASH-1.9). Transfer categories are left out. Uncategorized money in counts as income and money out
     * as expenses.
     */
    public static totals(flows: CategoryFlow[]): SpendingTotal[] {
        return flows.flatMap((flow): SpendingTotal[] => {
            switch (flow.categoryType) {
                case CategoryType.Income:
                    return [{ categoryId: flow.categoryId, type: CategoryType.Income, amount: net(flow) }];
                case CategoryType.Expense:
                    return [{ categoryId: flow.categoryId, type: CategoryType.Expense, amount: -net(flow) }];
                case CategoryType.Transfer:
                    return [];
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
     * The full months before the one `asOfDate` is in: the last 12, or from the month of the oldest transaction
     * Spending counts when that's more recent, or none when there isn't one before the current month.
     */
    public static averageWindow(asOfDate: CalendarDate, firstDate: CalendarDate | undefined): AverageWindow {
        const monthStart = (date: CalendarDate) => CalendarDateUtil.getPeriod(CalendarPeriod.Monthly, date).startDate;
        const currentMonth = monthStart(asOfDate);
        const endDate = CalendarDateUtil.addDays(currentMonth, -1);
        if (!firstDate || firstDate > endDate) {
            return { startDate: currentMonth, endDate, months: 0 };
        }

        const twelveMonthsBack = CalendarDateUtil.addMonths(currentMonth, -12);
        const firstMonth = monthStart(firstDate);
        const startDate = firstMonth > twelveMonthsBack ? firstMonth : twelveMonthsBack;
        return { startDate, endDate, months: monthIndex(currentMonth) - monthIndex(startDate) };
    }

    /**
     * The window's totals as an average month: Spending's totals (CASH-1.3), and each Transfer category's money out,
     * since the matching money in would cancel it (BUD-1.8).
     */
    public static average(flows: CategoryFlow[], window: AverageWindow): SpendingAverage {
        const perMonth = (amount: number) => Math.round((amount / window.months) * 100) / 100;
        return {
            ...window,
            totals: Spending.totals(flows).map(total => ({ ...total, amount: perMonth(total.amount) })),
            transfers: flows
                .filter(flow => flow.categoryType === CategoryType.Transfer)
                .map(flow => ({ categoryId: flow.categoryId, amount: perMonth(flow.moneyOut) }))
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
    return Math.round((flow.moneyIn - flow.moneyOut) * 100) / 100;
}
