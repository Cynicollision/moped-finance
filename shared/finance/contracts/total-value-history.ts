import { HistoryTimeframe, ValueHistoryType } from './../enum';

export type TotalValueHistoryOptions = {
    asOfDate: Date;
    type: ValueHistoryType;
    timeframe: HistoryTimeframe;
}

export type TotalValueHistory = {
    date: Date;
    amount: number;
    type: ValueHistoryType;
};
