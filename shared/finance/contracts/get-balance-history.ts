import { HistoryTimeframe } from './../../core/enum';
import { CalendarDate } from './../../core/types';

export interface GetAccountBalanceHistoryOptions {
    asOfDate: CalendarDate;
    timeframe: HistoryTimeframe;
}
