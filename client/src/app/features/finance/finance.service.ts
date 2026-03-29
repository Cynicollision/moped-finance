import { Injectable, inject } from '@angular/core';
import { GetAccountBalanceHistoryOptions, SpendingStream, TotalValueHistory, TransactionSearchOptions } from '@shared/finance/contracts';
import { BudgetPeriod, HistoryTimeframe, ValueHistoryType } from '@shared/finance/enum';
import { Institution, Account, Category, Transaction, BalanceHistory, BudgetStream } from '@shared/finance/types';
import { ApiService } from './../../core/api.service';
import { DateProviderService } from './../../core/date-provider.service';

@Injectable({
    providedIn: 'root'
})
export class FinanceService {
    private api = inject(ApiService);
    private dateProvider = inject(DateProviderService);

    // Metadata (Institutions, Categories)
    fetchInstitutions(): Promise<Institution[] | undefined> {
        return this.api.get<Institution[]>('api/finance/data/institutions');
    }

    fetchCategories(activeOnly: boolean): Promise<Category[] | undefined> {
        return this.api.get<Category[]>(`api/finance/data/categories?activeOnly=${activeOnly}`);
    }

    // Accounts
    fetchAccount(accountId: string): Promise<Account | undefined> {
        return this.api.get<Account>(`api/finance/data/accounts/${accountId}`);
    }

    fetchAllAccounts(): Promise<Account[] | undefined> {
        return this.api.get<Account[]>('api/finance/data/accounts');
    }

    createAccount(account: Account): Promise<Account | undefined> {
        return this.api.post<Account>(`api/finance/data/accounts`, account);
    }

    saveAccount(account: Account): Promise<Account | undefined> {
        return this.api.put<Account>(`api/finance/data/accounts/${account.id}`, account);
    }

    deleteAccount(id: string): Promise<boolean> {
        return this.api.delete(`api/finance/data/accounts/${id}`);
    }

    fetchAccountBalanceHistory(accountId: string, options: GetAccountBalanceHistoryOptions): Promise<BalanceHistory[] | undefined> {
        const url = `api/finance/data/accounts/${accountId}/balance-history?asOfDate=${options.asOfDate}&timeframe=${options.timeframe}`;
        return this.api.get<BalanceHistory[]>(url);
    }

    fetchTotalValueHistory(type: ValueHistoryType, timeframe: HistoryTimeframe): Promise<TotalValueHistory[] | undefined> {
        const asOfDate = this.dateProvider.now().toISOString().split('T')[0];
        const url = `api/finance/data/accounts/total-value-history?asOfDate=${asOfDate}&type=${type}&timeframe=${timeframe}`;
        return this.api.get<TotalValueHistory[]>(url);
    }

    // Transactions
    fetchTransaction(id: string): Promise<Transaction | undefined> {
        return this.api.get<Transaction>(`api/finance/data/transactions/${id}`);
    }

    fetchTransactions(options: TransactionSearchOptions): Promise<Transaction[] | undefined> {
        const params = this.getTransactionUrlParams(options);
        return this.api.get<Transaction[]>(`api/finance/data/transactions?${params.toString()}`);
    }

    fetchAccountRecentTransactions(accountId: string): Promise<Transaction[] | undefined> {
        const params = this.getTransactionUrlParams({
            sortKey: 'date',
            sortDirection: 'desc',
            limit: 10
        });
        return this.api.get<Transaction[]>(`api/finance/data/accounts/${accountId}/transactions?${params.toString()}`);
    }

    fetchTransactionMerchants(): Promise<string[] | undefined> {
        return this.api.get<string[]>(`api/finance/data/transactions/merchants`);
    }

    saveTransaction(transaction: Transaction): Promise<Transaction | undefined> {
        return this.api.put<Transaction>(`api/finance/data/transactions/${transaction.id}`, transaction);
    }

    deleteTransaction(id: string): Promise<boolean> {
        return this.api.delete(`api/finance/data/transactions/${id}`);
    }

    // Budget
    fetchBudgetStreams(): Promise<BudgetStream[] | undefined> {
        return this.api.get<BudgetStream[]>('api/finance/data/budget-streams');
    }

    createBudgetStream(stream: BudgetStream): Promise<BudgetStream | undefined> {
        return this.api.post<BudgetStream>('api/finance/data/budget-streams', stream);
    }

    saveBudgetStream(stream: BudgetStream): Promise<BudgetStream | undefined> {
        return this.api.put<BudgetStream>(`api/finance/data/budget-streams/${stream.id}`, stream);
    }

    deleteBudgetStream(id: string): Promise<boolean> {
        return this.api.delete(`api/finance/data/budget-streams/${id}`);
    }

    // Cashflow
    fetchSpendingStreams(period: BudgetPeriod, asOfDate: string): Promise<SpendingStream[] | undefined> {
        return this.api.get<SpendingStream[]>(`api/finance/data/transactions/spending?period=${period}&asOfDate=${asOfDate}`);
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
