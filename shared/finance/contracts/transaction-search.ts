import { SortDirection } from './../../core/enum';
import { CalendarDate } from './../../core/types';
import { TransactionsFilterKey, TransactionsSortKey } from './../enum';

export interface TransactionSearchFilterItem {
    key: TransactionsFilterKey;
    value: string;
}

export interface TransactionSearchOptions {
    sortKey?: TransactionsSortKey;
    sortDirection?: SortDirection;
    offset?: number;
    limit?: number;
    minAmount?: number;
    maxAmount?: number;
    startDate?: CalendarDate;
    endDate?: CalendarDate;
    filters?: TransactionSearchFilterItem[];
    includeHidden?: boolean;
}
