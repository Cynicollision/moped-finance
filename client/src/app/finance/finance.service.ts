import { Injectable, inject } from '@angular/core';
import { CalendarPeriod, HistoryTimeframe } from '@shared/core/enum';
import { GetAccountBalanceHistoryOptions, SpendingStream, TotalValueHistory, TransactionSearchOptions } from '@shared/finance/contracts';
import { ValueHistoryType } from '@shared/finance/enum';
import { Institution, Account, Category, Transaction, BalanceHistory, BudgetStream } from '@shared/finance/types';
import { ApiService } from './../core/api.service';
import { DateProviderService } from './../core/date-provider.service';

@Injectable({
    providedIn: 'root'
})
export class FinanceService {
    private api = inject(ApiService);
    private dateProvider = inject(DateProviderService);

    // Metadata (Institutions, Categories)
    fetchInstitutions(): Promise<Institution[] | undefined> {
        return this.api.get<Institution[]>('api/data/institutions');
    }

    fetchInstitution(id: string): Promise<Institution | undefined> {
        return this.api.get<Institution>(`api/data/institutions/${id}`);
    }

    createInstitution(institution: Institution): Promise<Institution | undefined> {
        return this.api.post<Institution>('api/data/institutions', institution);
    }

    saveInstitution(institution: Institution): Promise<Institution | undefined> {
        return this.api.put<Institution>(`api/data/institutions/${institution.id}`, institution);
    }

    deleteInstitution(id: string): Promise<boolean> {
        return this.api.delete(`api/data/institutions/${id}`);
    }

    fetchCategories(activeOnly: boolean): Promise<Category[] | undefined> {
        return this.api.get<Category[]>(`api/data/categories?activeOnly=${activeOnly}`);
    }

    // Accounts
    fetchAccount(accountId: string): Promise<Account | undefined> {
        return this.api.get<Account>(`api/data/accounts/${accountId}`);
    }

    fetchAllAccounts(): Promise<Account[] | undefined> {
        return this.api.get<Account[]>('api/data/accounts');
    }

    createAccount(account: Account): Promise<Account | undefined> {
        return this.api.post<Account>(`api/data/accounts`, account);
    }

    saveAccount(account: Account): Promise<Account | undefined> {
        return this.api.put<Account>(`api/data/accounts/${account.id}`, account);
    }

    deleteAccount(id: string): Promise<boolean> {
        return this.api.delete(`api/data/accounts/${id}`);
    }

    fetchAccountBalanceHistory(accountId: string, options: GetAccountBalanceHistoryOptions): Promise<BalanceHistory[] | undefined> {
        const url = `api/data/accounts/${accountId}/balance-history?asOfDate=${options.asOfDate}&timeframe=${options.timeframe}`;
        return this.api.get<BalanceHistory[]>(url);
    }

    importBalanceHistory(accountId: string, formData: FormData, dryRun: boolean): Promise<any> {
        return this.api.post(`api/data/accounts/${accountId}/import-balances?dryRun=${dryRun}`, formData);
    }

    getExportBalanceHistoryUrl(accountId: string): string {
        return `/api/data/accounts/${accountId}/export-balances`;
    }

    fetchTotalValueHistory(type: ValueHistoryType, timeframe: HistoryTimeframe): Promise<TotalValueHistory[] | undefined> {
        const asOfDate = this.dateProvider.now().toISOString().split('T')[0];
        const url = `api/data/accounts/total-value-history?asOfDate=${asOfDate}&type=${type}&timeframe=${timeframe}`;
        return this.api.get<TotalValueHistory[]>(url);
    }

    // Transactions
    fetchTransaction(id: string): Promise<Transaction | undefined> {
        return this.api.get<Transaction>(`api/data/transactions/${id}`);
    }

    fetchTransactions(options: TransactionSearchOptions): Promise<Transaction[] | undefined> {
        const params = this.getTransactionUrlParams(options);
        return this.api.get<Transaction[]>(`api/data/transactions?${params.toString()}`);
    }

    fetchAccountRecentTransactions(accountId: string): Promise<Transaction[] | undefined> {
        const params = this.getTransactionUrlParams({
            sortKey: 'date',
            sortDirection: 'desc',
            limit: 10
        });
        return this.api.get<Transaction[]>(`api/data/accounts/${accountId}/transactions?${params.toString()}`);
    }

    fetchTransactionMerchants(): Promise<string[] | undefined> {
        return this.api.get<string[]>(`api/data/transactions/merchants`);
    }

    saveTransaction(transaction: Transaction): Promise<Transaction | undefined> {
        return this.api.put<Transaction>(`api/data/transactions/${transaction.id}`, transaction);
    }

    createTransaction(transaction: Transaction): Promise<Transaction | undefined> {
        return this.api.post<Transaction>('api/data/transactions', transaction);
    }

    importTransactions(formData: FormData, dryRun: boolean, accountId?: string | null): Promise<any> {
        let url = `api/data/transactions/import?dryRun=${dryRun}`;
        if (accountId) {
            url += `&accountId=${accountId}`;
        }
        return this.api.post(url, formData);
    }

    getExportTransactionsUrl(accountId?: string): string {
        let url = `/api/data/transactions/export`;
        if (accountId) {
            url += `?accountId=${accountId}`;
        }
        return url;
    }

    deleteTransaction(id: string): Promise<boolean> {
        return this.api.delete(`api/data/transactions/${id}`);
    }

    // Budget
    fetchBudgetStreams(): Promise<BudgetStream[] | undefined> {
        return this.api.get<BudgetStream[]>('api/data/budget-streams');
    }

    createBudgetStream(stream: BudgetStream): Promise<BudgetStream | undefined> {
        return this.api.post<BudgetStream>('api/data/budget-streams', stream);
    }

    saveBudgetStream(stream: BudgetStream): Promise<BudgetStream | undefined> {
        return this.api.put<BudgetStream>(`api/data/budget-streams/${stream.id}`, stream);
    }

    deleteBudgetStream(id: string): Promise<boolean> {
        return this.api.delete(`api/data/budget-streams/${id}`);
    }

    // Cashflow
    fetchSpendingStreams(period: CalendarPeriod, asOfDate: string): Promise<SpendingStream[] | undefined> {
        return this.api.get<SpendingStream[]>(`api/data/transactions/spending?period=${period}&asOfDate=${asOfDate}`);
    }

    private getTransactionUrlParams(options: TransactionSearchOptions): URLSearchParams {
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
