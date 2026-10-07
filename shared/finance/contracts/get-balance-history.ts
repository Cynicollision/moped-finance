import { HistoryTimeframe } from './../../core/enum';
import { CalendarDate } from './../../core/types';

export interface GetAccountBalanceHistoryOptions {
    asOfDate: CalendarDate;
    timeframe: HistoryTimeframe;
}

/** An account's balance on a day: its latest entry on or before that day, carried forward (ACCT-2.11). */
export interface DailyBalance {
    date: CalendarDate;
    balance: number;
}
