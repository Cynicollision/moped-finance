import { HistoryTimeframe } from './../../common/enum';

export type GetAccountBalanceHistoryOptions = {
    asOfDate: Date;
    timeframe: HistoryTimeframe;
}