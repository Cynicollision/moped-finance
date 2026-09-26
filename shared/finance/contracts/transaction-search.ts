import { SortDirection } from './../../core/enum';
import { TransactionsFilterKey, TransactionsSortKey } from './../enum';

export type TransactionSearchFilterItem = {
    key: TransactionsFilterKey;
    value: string;
}

export type TransactionSearchOptions = {
    sortKey?: TransactionsSortKey;
    sortDirection?: SortDirection;
    offset?: number;
    limit?: number;
    minAmount?: number;
    maxAmount?: number;
    startDate?: string;
    endDate?: string;
    filters?: TransactionSearchFilterItem[];
    includeHidden?: boolean;
};
