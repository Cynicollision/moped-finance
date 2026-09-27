import { HistoryTimeframe } from './../../core/enum';
import { CalendarDate } from './../../core/types';

export type GetAccountBalanceHistoryOptions = {
    asOfDate: CalendarDate;
    timeframe: HistoryTimeframe;
}
