import { HistoryTimeframe } from './../../core/enum';

export type GetAccountBalanceHistoryOptions = {
    asOfDate: Date;
    timeframe: HistoryTimeframe;
}