import { Injectable, inject } from '@angular/core';
import { CalendarPeriod, HistoryTimeframe } from '@shared/core/enum';
import { NewEntity } from '@shared/core/types';
import { BalanceImportResult, CashflowStream, GetAccountBalanceHistoryOptions, TotalValueHistory, TransactionImportResult, TransactionSearchOptions } from '@shared/finance/contracts';
import { ValueHistoryType } from '@shared/finance/enum';
import { Institution, Account, Category, CategoryGroup, Transaction, BalanceHistory, BudgetStream } from '@shared/finance/types';
import { ApiService } from './../core/api.service';
import { DateProviderService } from './../core/date-provider.service';


const API_BASE_PATH = 'api/v1';

@Injectable({
    providedIn: 'root'
})
export class FinanceService {
    private api = inject(ApiService);
    private dateProvider = inject(DateProviderService);

    // Metadata (Institutions, Categories)
    fetchInstitutions(): Promise<Institution[] | undefined> {
        return this.api.get<Institution[]>(`${API_BASE_PATH}/institutions`);
    }

    fetchInstitution(id: string): Promise<Institution | undefined> {
        return this.api.get<Institution>(`${API_BASE_PATH}/institutions/${id}`);
    }

    createInstitution(institution: NewEntity<Institution>): Promise<Institution | undefined> {
        return this.api.post<Institution>(`${API_BASE_PATH}/institutions`, institution);
    }

    saveInstitution(institution: Institution): Promise<Institution | undefined> {
        return this.api.put<Institution>(`${API_BASE_PATH}/institutions/${institution.id}`, institution);
    }

    deleteInstitution(id: string): Promise<boolean> {
        return this.api.delete(`${API_BASE_PATH}/institutions/${id}`);
    }

    fetchCategories(activeOnly: boolean): Promise<Category[] | undefined> {
        return this.api.get<Category[]>(`${API_BASE_PATH}/categories?activeOnly=${activeOnly}`);
    }

    fetchCategoryGroups(): Promise<CategoryGroup[] | undefined> {
        return this.api.get<CategoryGroup[]>(`${API_BASE_PATH}/categories/groups`);
    }

    createCategoryGroup(group: NewEntity<CategoryGroup>): Promise<CategoryGroup | undefined> {
        return this.api.post<CategoryGroup>(`${API_BASE_PATH}/categories/groups`, group);
    }

    saveCategoryGroup(group: CategoryGroup): Promise<CategoryGroup | undefined> {
        return this.api.put<CategoryGroup>(`${API_BASE_PATH}/categories/groups/${group.id}`, group);
    }

    deleteCategoryGroup(id: string): Promise<boolean> {
        return this.api.delete(`${API_BASE_PATH}/categories/groups/${id}`);
    }

    createCategory(category: NewEntity<Category>): Promise<Category | undefined> {
        return this.api.post<Category>(`${API_BASE_PATH}/categories`, category);
    }

    saveCategory(category: Category): Promise<Category | undefined> {
        return this.api.put<Category>(`${API_BASE_PATH}/categories/${category.id}`, category);
    }

    deleteCategory(id: string): Promise<boolean> {
        return this.api.delete(`${API_BASE_PATH}/categories/${id}`);
    }

    // Accounts
    fetchAccount(accountId: string): Promise<Account | undefined> {
        return this.api.get<Account>(`${API_BASE_PATH}/accounts/${accountId}`);
    }

    fetchAllAccounts(): Promise<Account[] | undefined> {
        return this.api.get<Account[]>(`${API_BASE_PATH}/accounts`);
    }

    createAccount(account: NewEntity<Account>): Promise<Account | undefined> {
        return this.api.post<Account>(`${API_BASE_PATH}/accounts`, account);
    }

    saveAccount(account: Account): Promise<Account | undefined> {
        return this.api.put<Account>(`${API_BASE_PATH}/accounts/${account.id}`, account);
    }

    deleteAccount(id: string): Promise<boolean> {
        return this.api.delete(`${API_BASE_PATH}/accounts/${id}`);
    }

    fetchAccountBalanceHistory(accountId: string, options: GetAccountBalanceHistoryOptions): Promise<BalanceHistory[] | undefined> {
        const url = `${API_BASE_PATH}/accounts/${accountId}/balance-history?asOfDate=${options.asOfDate}&timeframe=${options.timeframe}`;
        return this.api.get<BalanceHistory[]>(url);
    }

    importBalanceHistory(accountId: string, formData: FormData, dryRun: boolean): Promise<BalanceImportResult | undefined> {
        return this.api.post<BalanceImportResult>(`${API_BASE_PATH}/accounts/${accountId}/import-balances?dryRun=${dryRun}`, formData);
    }

    getExportBalanceHistoryUrl(accountId: string): string {
        return `/${API_BASE_PATH}/accounts/${accountId}/export-balances`;
    }

    fetchTotalValueHistory(type: ValueHistoryType, timeframe: HistoryTimeframe): Promise<TotalValueHistory[] | undefined> {
        const asOfDate = this.dateProvider.now().toISOString().split('T')[0];
        const url = `${API_BASE_PATH}/accounts/total-value-history?asOfDate=${asOfDate}&type=${type}&timeframe=${timeframe}`;
        return this.api.get<TotalValueHistory[]>(url);
    }

    // Transactions
    fetchTransaction(id: string): Promise<Transaction | undefined> {
        return this.api.get<Transaction>(`${API_BASE_PATH}/transactions/${id}`);
    }

    fetchTransactions(options: TransactionSearchOptions): Promise<Transaction[] | undefined> {
        const params = this.getTransactionUrlParams(options);
        return this.api.get<Transaction[]>(`${API_BASE_PATH}/transactions?${params.toString()}`);
    }

    fetchAccountRecentTransactions(accountId: string): Promise<Transaction[] | undefined> {
        const params = this.getTransactionUrlParams({
            sortKey: 'date',
            sortDirection: 'desc',
            limit: 10
        });
        return this.api.get<Transaction[]>(`${API_BASE_PATH}/accounts/${accountId}/transactions?${params.toString()}`);
    }

    fetchTransactionMerchants(): Promise<string[] | undefined> {
        return this.api.get<string[]>(`${API_BASE_PATH}/transactions/merchants`);
    }

    saveTransaction(transaction: Transaction): Promise<Transaction | undefined> {
        return this.api.put<Transaction>(`${API_BASE_PATH}/transactions/${transaction.id}`, transaction);
    }

    createTransaction(transaction: NewEntity<Transaction>): Promise<Transaction | undefined> {
        return this.api.post<Transaction>(`${API_BASE_PATH}/transactions`, transaction);
    }

    importTransactions(formData: FormData, dryRun: boolean, accountId?: string | null): Promise<TransactionImportResult | undefined> {
        let url = `${API_BASE_PATH}/transactions/import?dryRun=${dryRun}`;
        if (accountId) {
            url += `&accountId=${accountId}`;
        }
        return this.api.post<TransactionImportResult>(url, formData);
    }

    getExportTransactionsUrl(accountId?: string): string {
        let url = `${API_BASE_PATH}/transactions/export`;
        if (accountId) {
            url += `?accountId=${accountId}`;
        }
        return url;
    }

    deleteTransaction(id: string): Promise<boolean> {
        return this.api.delete(`${API_BASE_PATH}/transactions/${id}`);
    }

    // Budget
    fetchBudgetStreams(): Promise<BudgetStream[] | undefined> {
        return this.api.get<BudgetStream[]>(`${API_BASE_PATH}/budget-streams`);
    }

    createBudgetStream(stream: NewEntity<BudgetStream>): Promise<BudgetStream | undefined> {
        return this.api.post<BudgetStream>(`${API_BASE_PATH}/budget-streams`, stream);
    }

    saveBudgetStream(stream: BudgetStream): Promise<BudgetStream | undefined> {
        return this.api.put<BudgetStream>(`${API_BASE_PATH}/budget-streams/${stream.id}`, stream);
    }

    deleteBudgetStream(id: string): Promise<boolean> {
        return this.api.delete(`${API_BASE_PATH}/budget-streams/${id}`);
    }

    // Cashflow
    fetchCashflowStreams(period: CalendarPeriod, asOfDate: string): Promise<CashflowStream[] | undefined> {
        return this.api.get<CashflowStream[]>(`${API_BASE_PATH}/transactions/cashflow?period=${period}&asOfDate=${asOfDate}`);
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
