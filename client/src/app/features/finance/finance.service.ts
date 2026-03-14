import { Injectable, inject } from '@angular/core';
import { OperationResult } from '@shared/core/contracts';
import { GetAccountBalanceHistoryOptions, GetTransactionsOptions, ProfileValueHistory } from '@shared/finance/contracts';
import { HistoryTimeframe, ValueHistoryType } from '@shared/finance/enum';
import { FinanceProfile, Institution, Account, Category, Transaction, BalanceHistory } from '@shared/finance/types';
import { ApiService } from './../../core/api.service';
import { LoadingService } from './../../core/loading.service';
import { NotificationService } from './../../core/notification.service';

@Injectable({
    providedIn: 'root'
})
export class FinanceService {
    private api = inject(ApiService);
    private loader = inject(LoadingService);
    private notificationService = inject(NotificationService);

    async fetchAccount(accountId: string): Promise<Account | undefined> {
        try {
            const task = this.api.get<OperationResult<Account>>(`api/finance/data/accounts/${accountId}`);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch account: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    async fetchAccounts(): Promise<Account[] | undefined> {
        try {
            const task = this.api.get<OperationResult<Account[]>>('api/finance/data/accounts');
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch accounts: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    async fetchAccountBalanceHistory(accountId: string, options: GetAccountBalanceHistoryOptions): Promise<BalanceHistory[] | undefined> {
        try {
            const url = `api/finance/data/accounts/${accountId}/balance-history?startDate=${options.startDate}&endDate=${options.endDate}`;
            const task = this.api.get<OperationResult<BalanceHistory[]>>(url);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch account balance history: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    async fetchCategories(activeOnly: boolean): Promise<Category[] | undefined> {
        try {
            const task = this.api.get<OperationResult<Category[]>>(`api/finance/data/categories?activeOnly=${activeOnly}`);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch categories: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    async fetchProfileValueHistory(type: ValueHistoryType, timeframe: HistoryTimeframe): Promise<ProfileValueHistory[] | undefined> {
        try {
            const asOfDate = '2026-02-28'; // TODO: replace with current date

            const url = `api/finance/data/profile/value-history?asOfDate=${asOfDate}&type=${type}&timeframe=${timeframe}`;
            const task = this.api.get<OperationResult<ProfileValueHistory[]>>(url);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch profile value history: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    async fetchTransactionMerchants(): Promise<string[] | undefined> {
        try {
            const task = this.api.get<OperationResult<string[]>>(`api/finance/data/transactions/merchants`);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch transaction merchants: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    async fetchTransactions(options: GetTransactionsOptions): Promise<Transaction[] | undefined> {
        try {
            const params = new URLSearchParams();
            if (options.sortKey) {
                params.append('sortKey', options.sortKey);
            }
            if (options.sortDirection) {
                params.append('sortDirection', options.sortDirection);
            }
            if (options.offset !== undefined) {
                params.append('offset', options.offset.toString());
            }
            if (options.limit !== undefined) {
                params.append('limit', options.limit.toString());
            }
            if (options.minAmount !== undefined) {
                params.append('minAmount', options.minAmount.toString());
            }
            if (options.maxAmount !== undefined) {
                params.append('maxAmount', options.maxAmount.toString());
            }
            if (options.startDate) {
                params.append('startDate', options.startDate);
            }
            if (options.endDate) {
                params.append('endDate', options.endDate);
            }
            if (options.filters) {
                params.append('filters', JSON.stringify(options.filters));
            }

            const task = this.api.get<OperationResult<Transaction[]>>(`api/finance/data/transactions?${params.toString()}`);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch transactions: ${JSON.stringify(error)}`);
            return undefined;
        }
    }
}
