import { HistoryTimeframe } from './../enum';

export type GetAccountBalanceHistoryOptions = {
    asOfDate: Date;
    timeframe: HistoryTimeframe;
}