import { BudgetPeriod, HistoryTimeframe } from '@shared/finance/enum';

export function getCurrentTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Calculates a starting Date object based on a requested HistoryTimeframe duration looking backwards from a given asOfDate.
 */
export function getStartDateForTimeframe(timeframe: HistoryTimeframe, asOfDate: Date = new Date()): Date {
    const startDate = new Date(asOfDate.getTime()); // Clone to avoid mutating original

    switch (timeframe) {
        case HistoryTimeframe.PastThirtyDays: startDate.setDate(startDate.getDate() - 30); break;
        case HistoryTimeframe.PastSixtyDays: startDate.setDate(startDate.getDate() - 60); break;
        case HistoryTimeframe.PastNinetyDays: startDate.setDate(startDate.getDate() - 90); break;
        case HistoryTimeframe.PastOneYear: startDate.setFullYear(startDate.getFullYear() - 1); break;
        case HistoryTimeframe.PastTwoYears: startDate.setFullYear(startDate.getFullYear() - 2); break;
        case HistoryTimeframe.PastFiveYears: startDate.setFullYear(startDate.getFullYear() - 5); break;
        case HistoryTimeframe.PastTenYears: startDate.setFullYear(startDate.getFullYear() - 10); break;
        case HistoryTimeframe.YearToDate:
            startDate.setMonth(0);
            startDate.setDate(1);
            startDate.setHours(0, 0, 0, 0);
            break;
        case HistoryTimeframe.All: startDate.setFullYear(1970); break; // Arbitrary old date
    }

    return startDate;
}

export function getDatesForPeriod(period: BudgetPeriod, asOfDate: Date = new Date()): { startDate: Date; endDate: Date } {
    const startDate = new Date(asOfDate.getTime());
    const endDate = new Date(asOfDate.getTime());

    switch (period) {
        case BudgetPeriod.Monthly:
            startDate.setDate(1);
            endDate.setMonth(endDate.getMonth() + 1, 0);
            break;

        case BudgetPeriod.Quarterly: {
            const currentMonth = startDate.getMonth(); // 0-indexed
            const quarterStartMonth = Math.floor(currentMonth / 3) * 3;
            startDate.setMonth(quarterStartMonth, 1);
            endDate.setMonth(quarterStartMonth + 3, 0);
            break;
        }

        case BudgetPeriod.Yearly:
            startDate.setMonth(0, 1);
            endDate.setMonth(11, 31);
            break;
    }

    // Set time to the start of the first day and the end of the last day
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    return { startDate, endDate };
}