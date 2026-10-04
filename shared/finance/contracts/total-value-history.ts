import { HistoryTimeframe } from './../../core/enum';
import { CalendarDate } from './../../core/types';
import { ValueHistoryType } from './../enum';

export interface TotalValueHistoryOptions {
    asOfDate: CalendarDate;
    type: ValueHistoryType;
    timeframe: HistoryTimeframe;
}

export interface TotalValueHistory {
    date: CalendarDate;
    amount: number;
    type: ValueHistoryType;
}
