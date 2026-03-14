import { TransactionsFilterKey } from '../enum/transactions-filter-key';

export type GetTransactionsFilterItem = {
    key: TransactionsFilterKey;
    value: string;
}

export type GetTransactionsOptions = {
    sortKey?: string;
    sortDirection?: string;
    offset?: number;
    limit?: number;
    minAmount?: number;
    maxAmount?: number;
    startDate?: string;
    endDate?: string;
    filters?: GetTransactionsFilterItem[];
};
