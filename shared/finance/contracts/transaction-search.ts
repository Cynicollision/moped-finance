import { TransactionsFilterKey } from './../enum/transactions-filter-key';

export type TransactionSearchFilterItem = {
    key: TransactionsFilterKey;
    value: string;
}

export type TransactionSearchOptions = {
    sortKey?: string;
    sortDirection?: string;
    offset?: number;
    limit?: number;
    minAmount?: number;
    maxAmount?: number;
    startDate?: string;
    endDate?: string;
    filters?: TransactionSearchFilterItem[];
    includeHidden?: boolean;
};
