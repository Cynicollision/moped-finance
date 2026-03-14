import { HistoryTimeframe } from '@shared/finance/enum';

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
        case HistoryTimeframe.All: startDate.setFullYear(1970); break; // Arbitrary old date
    }

    return startDate;
}