import { HistoryTimeframe, ValueHistoryType } from './../enum';

export type ProfileValueHistoryOptions = {
    asOfDate: Date;
    type: ValueHistoryType;
    timeframe: HistoryTimeframe;
}

export type ProfileValueHistory = {
    date: Date;
    amount: number;
    type: ValueHistoryType;
};
