import { SortDirection } from './../../core/enum';
import { CalendarDate } from './../../core/types';
import { TransactionDirection, TransactionsFilterKey, TransactionsSortKey } from './../enum';

export interface TransactionSearchFilterItem {
    key: TransactionsFilterKey;
    value: string;
}

export interface TransactionSearchOptions {
    sortKey?: TransactionsSortKey;
    sortDirection?: SortDirection;
    offset?: number;
    limit?: number;
    /** Bounds on the amount's size, ignoring its sign (TXN-1.14). */
    minAmount?: number;
    maxAmount?: number;
    direction?: TransactionDirection;
    startDate?: CalendarDate;
    endDate?: CalendarDate;
    filters?: TransactionSearchFilterItem[];
    includeHidden?: boolean;
}
