import { Injectable, inject } from '@angular/core';
import { OperationResult } from '@shared/core/contracts';
import { GetAccountBalanceHistoryOptions, GetTransactionsOptions, SpendingStream, TotalValueHistory } from '@shared/finance/contracts';
import { BudgetPeriod, HistoryTimeframe, ValueHistoryType } from '@shared/finance/enum';
import { Institution, Account, Category, Transaction, BalanceHistory, BudgetStream } from '@shared/finance/types';
import { ApiService } from './../../core/api.service';
import { LoadingService } from './../../core/loading/loading.service';
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

    async saveAccount(account: Account): Promise<Account | undefined> {
        try {
            const task = this.api.put<OperationResult<Account>>(`api/finance/data/accounts/${account.id}`, account);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to save account: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    async deleteAccount(id: string): Promise<boolean> {
        try {
            const task = this.api.delete<OperationResult<void>>(`api/finance/data/accounts/${id}`);
            const response = await this.loader.withLoading(task);
            return response.success;
        }
        catch (error) {
            this.notificationService.error(`Unable to delete account: ${JSON.stringify(error)}`);
            return false;
        }
    }


    async fetchAccountBalanceHistory(accountId: string, options: GetAccountBalanceHistoryOptions): Promise<BalanceHistory[] | undefined> {
        try {
            const url = `api/finance/data/accounts/${accountId}/balance-history?asOfDate=${options.asOfDate}&timeframe=${options.timeframe}`;
            const task = this.api.get<OperationResult<BalanceHistory[]>>(url);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch account balance history: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    async fetchBudgetStreams(): Promise<BudgetStream[] | undefined> {
        try {
            const task = this.api.get<OperationResult<BudgetStream[]>>('api/finance/data/budget-streams');
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch budget streams: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    async saveBudgetStream(stream: BudgetStream): Promise<BudgetStream | undefined> {
        try {
            const task = this.api.post<BudgetStream>('api/finance/data/budget-streams', stream);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to save budget stream: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    async deleteBudgetStream(id: string): Promise<boolean> {
        try {
            const task = this.api.delete<OperationResult<void>>(`api/finance/data/budget-streams/${id}`);
            const response = await this.loader.withLoading(task);
            return response.success;
        }
        catch (error) {
            this.notificationService.error(`Unable to delete budget stream: ${JSON.stringify(error)}`);
            return false;
        }
    }

    async fetchAccountRecentTransactions(accountId: string): Promise<Transaction[] | undefined> {
        try {
            const params = this.getTransactionUrlParams({
                sortKey: 'date',
                sortDirection: 'desc',
                limit: 10
            });

            const url = `api/finance/data/accounts/${accountId}/transactions?${params.toString()}`;
            const task = this.api.get<OperationResult<Transaction[]>>(url);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch account transactions: ${JSON.stringify(error)}`);
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

    async fetchInstitutions(): Promise<Institution[] | undefined> {
        try {
            const task = this.api.get<OperationResult<Institution[]>>('api/finance/data/institutions');
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch institutions: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    async fetchTotalValueHistory(type: ValueHistoryType, timeframe: HistoryTimeframe): Promise<TotalValueHistory[] | undefined> {
        try {
            const asOfDate = '2026-02-28'; // TODO: replace with current date

            const url = `api/finance/data/accounts/total-value-history?asOfDate=${asOfDate}&type=${type}&timeframe=${timeframe}`;
            const task = this.api.get<OperationResult<TotalValueHistory[]>>(url);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch total value history: ${JSON.stringify(error)}`);
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
            const params = this.getTransactionUrlParams(options);
            const url = `api/finance/data/transactions?${params.toString()}`;
            const task = this.api.get<OperationResult<Transaction[]>>(url);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch transactions: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    async fetchTransaction(id: string): Promise<Transaction | undefined> {
        try {
            const task = this.api.get<OperationResult<Transaction>>(`api/finance/data/transactions/${id}`);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch transaction: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    async saveTransaction(transaction: Transaction): Promise<Transaction | undefined> {
        try {
            const task = this.api.put<OperationResult<Transaction>>(`api/finance/data/transactions/${transaction.id}`, transaction);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to save transaction: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    async deleteTransaction(id: string): Promise<boolean> {
        try {
            const task = this.api.delete<OperationResult<void>>(`api/finance/data/transactions/${id}`);
            const response = await this.loader.withLoading(task);
            return response.success;
        }
        catch (error) {
            this.notificationService.error(`Unable to delete transaction: ${JSON.stringify(error)}`);
            return false;
        }
    }

    async fetchSpendingStreams(period: BudgetPeriod, asOfDate: string): Promise<SpendingStream[] | undefined> {
        try {
            const url = `api/finance/data/transactions/spending?period=${period}&asOfDate=${asOfDate}`;
            const task = this.api.get<OperationResult<SpendingStream[]>>(url);
            const response = await this.loader.withLoading(task);
            return response.data;
        }
        catch (error) {
            this.notificationService.error(`Unable to fetch spending streams: ${JSON.stringify(error)}`);
            return undefined;
        }
    }

    private getTransactionUrlParams(options: GetTransactionsOptions): URLSearchParams {
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

        return params;
    }
}
