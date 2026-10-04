import { HistoryTimeframe } from './../../core/enum';
import { CalendarDate } from './../../core/types';
import { ValueHistoryType } from './../enum';

export type TotalValueHistoryOptions = {
    asOfDate: CalendarDate;
    type: ValueHistoryType;
    timeframe: HistoryTimeframe;
};

export type TotalValueHistory = {
    date: CalendarDate;
    amount: number;
    type: ValueHistoryType;
};
