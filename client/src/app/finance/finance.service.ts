import { Injectable, inject } from '@angular/core';
import { CalendarPeriod, HistoryTimeframe, SortDirection } from '@shared/core/enum';
import { CalendarDate, NewEntity } from '@shared/core/types';
import {
    AccountGroupChange,
    BalanceImportResult,
    CategoryImportResult,
    SpendingTotal,
    DailyBalance,
    GetAccountBalanceHistoryOptions,
    TotalValueHistory,
    TransactionImportResult,
    TransactionSearchOptions
} from '@shared/finance/contracts';
import { TransactionsSortKey, ValueHistoryType } from '@shared/finance/enum';
import {
    Institution,
    Account,
    AccountRequest,
    Category,
    CloseAccountRequest,
    CategoryGroup,
    CategoryUsage,
    Transaction,
    BudgetStream,
    BudgetStreamFields
} from '@shared/finance/types';
import { ApiService } from './../core/api.service';
import { DateProviderService } from './../core/date-provider.service';

const API_BASE_PATH = 'api/v1';

/**
 * The finance API. `fetch*` methods load what a screen shows and throw on failure (use them through
 * `viewResource`); the others are actions, which report their own failures and resolve to undefined.
 */
@Injectable({
    providedIn: 'root'
})
export class FinanceService {
    private api = inject(ApiService);
    private dateProvider = inject(DateProviderService);

    // Metadata (Institutions, Categories)
    fetchInstitutions(): Promise<Institution[]> {
        return this.api.load<Institution[]>(`${API_BASE_PATH}/institutions`);
    }

    fetchInstitution(id: string): Promise<Institution> {
        return this.api.load<Institution>(`${API_BASE_PATH}/institutions/${id}`);
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

    fetchInstitutionAccounts(institutionId: string): Promise<Account[]> {
        return this.api.load<Account[]>(
            `${API_BASE_PATH}/institutions/${institutionId}/accounts?asOfDate=${this.dateProvider.today()}`
        );
    }

    fetchCategories(activeOnly: boolean): Promise<Category[]> {
        return this.api.load<Category[]>(`${API_BASE_PATH}/categories?activeOnly=${activeOnly}`);
    }

    fetchCategoryGroups(): Promise<CategoryGroup[]> {
        return this.api.load<CategoryGroup[]>(`${API_BASE_PATH}/categories/groups`);
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

    fetchCategoryUsage(id: string): Promise<CategoryUsage> {
        return this.api.load<CategoryUsage>(`${API_BASE_PATH}/categories/${id}/usage`);
    }

    /** Deletes a category, moving its transactions to `moveToId`, or leaving them Uncategorized without one (CAT-4.4). */
    deleteCategory(id: string, moveToId?: string): Promise<boolean> {
        const query = moveToId ? `?moveTo=${encodeURIComponent(moveToId)}` : '';
        return this.api.delete(`${API_BASE_PATH}/categories/${id}${query}`);
    }

    importCategories(formData: FormData, dryRun: boolean): Promise<CategoryImportResult | undefined> {
        return this.api.post<CategoryImportResult>(`${API_BASE_PATH}/categories/import?dryRun=${dryRun}`, formData);
    }

    getExportCategoriesUrl(): string {
        return `${API_BASE_PATH}/categories/export`;
    }

    // Accounts, with their balance as of the app's today (ACCT-2.1).
    fetchAccount(accountId: string): Promise<Account> {
        return this.api.load<Account>(`${API_BASE_PATH}/accounts/${accountId}?asOfDate=${this.dateProvider.today()}`);
    }

    fetchAllAccounts(): Promise<Account[]> {
        return this.api.load<Account[]>(`${API_BASE_PATH}/accounts?asOfDate=${this.dateProvider.today()}`);
    }

    /** Adds an account and, with `balanceEntry`, its starting balance (ACCT-1.4). */
    createAccount(account: AccountRequest): Promise<Account | undefined> {
        return this.api.post<Account>(`${API_BASE_PATH}/accounts`, account);
    }

    /** Saves an account's changes and, with `balanceEntry`, its balance on that date (ACCT-2.2). */
    saveAccount(accountId: string, changes: AccountRequest): Promise<Account | undefined> {
        return this.api.put<Account>(`${API_BASE_PATH}/accounts/${accountId}`, changes);
    }

    /** Closes the account on the date: its balance becomes 0 then, and later entries are removed (ACCT-6.1). */
    closeAccount(accountId: string, closedOn: CalendarDate): Promise<Account | undefined> {
        const request: CloseAccountRequest = { closedOn };
        return this.api.post<Account>(`${API_BASE_PATH}/accounts/${accountId}/close`, request);
    }

    /** Makes a closed account open again, without changing its balance history (ACCT-6.3). */
    reopenAccount(accountId: string): Promise<Account | undefined> {
        return this.api.post<Account>(`${API_BASE_PATH}/accounts/${accountId}/reopen`, {});
    }

    deleteAccount(id: string): Promise<boolean> {
        return this.api.delete(`${API_BASE_PATH}/accounts/${id}`);
    }

    fetchAccountBalanceHistory(accountId: string, options: GetAccountBalanceHistoryOptions): Promise<DailyBalance[]> {
        const url = `${API_BASE_PATH}/accounts/${accountId}/balance-history?asOfDate=${options.asOfDate}&timeframe=${options.timeframe}`;
        return this.api.load<DailyBalance[]>(url);
    }

    importBalanceHistory(
        accountId: string,
        formData: FormData,
        dryRun: boolean
    ): Promise<BalanceImportResult | undefined> {
        return this.api.post<BalanceImportResult>(
            `${API_BASE_PATH}/accounts/${accountId}/import-balances?dryRun=${dryRun}`,
            formData
        );
    }

    getExportBalanceHistoryUrl(accountId: string): string {
        return `/${API_BASE_PATH}/accounts/${accountId}/export-balances`;
    }

    fetchTotalValueHistory(type: ValueHistoryType, timeframe: HistoryTimeframe): Promise<TotalValueHistory[]> {
        const asOfDate = this.dateProvider.today();
        const url = `${API_BASE_PATH}/accounts/total-value-history?asOfDate=${asOfDate}&type=${type}&timeframe=${timeframe}`;
        return this.api.load<TotalValueHistory[]>(url);
    }

    /** Each account group's first and last daily totals over the timeframe, up to the app's today (DASH-2.2). */
    fetchAccountGroupChanges(timeframe: HistoryTimeframe): Promise<AccountGroupChange[]> {
        const asOfDate = this.dateProvider.today();
        return this.api.load<AccountGroupChange[]>(
            `${API_BASE_PATH}/accounts/group-changes?asOfDate=${asOfDate}&timeframe=${timeframe}`
        );
    }

    // Transactions
    fetchTransaction(id: string): Promise<Transaction> {
        return this.api.load<Transaction>(`${API_BASE_PATH}/transactions/${id}`);
    }

    fetchTransactions(options: TransactionSearchOptions): Promise<Transaction[]> {
        const params = this.getTransactionUrlParams(options);
        return this.api.load<Transaction[]>(`${API_BASE_PATH}/transactions?${params.toString()}`);
    }

    fetchAccountRecentTransactions(accountId: string): Promise<Transaction[]> {
        const params = this.getTransactionUrlParams({
            sortKey: TransactionsSortKey.Date,
            sortDirection: SortDirection.Desc,
            limit: 10
        });
        return this.api.load<Transaction[]>(`${API_BASE_PATH}/accounts/${accountId}/transactions?${params.toString()}`);
    }

    fetchTransactionMerchants(): Promise<string[]> {
        return this.api.load<string[]>(`${API_BASE_PATH}/transactions/merchants`);
    }

    saveTransaction(transaction: Transaction): Promise<Transaction | undefined> {
        return this.api.put<Transaction>(`${API_BASE_PATH}/transactions/${transaction.id}`, transaction);
    }

    createTransaction(transaction: NewEntity<Transaction>): Promise<Transaction | undefined> {
        return this.api.post<Transaction>(`${API_BASE_PATH}/transactions`, transaction);
    }

    importTransactions(
        formData: FormData,
        dryRun: boolean,
        accountId?: string | null
    ): Promise<TransactionImportResult | undefined> {
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
    fetchBudgetStreams(): Promise<BudgetStream[]> {
        return this.api.load<BudgetStream[]>(`${API_BASE_PATH}/budget-streams`);
    }

    createBudgetStream(stream: NewEntity<BudgetStreamFields>): Promise<BudgetStream | undefined> {
        return this.api.post<BudgetStream>(`${API_BASE_PATH}/budget-streams`, stream);
    }

    saveBudgetStream(stream: BudgetStreamFields): Promise<BudgetStream | undefined> {
        return this.api.put<BudgetStream>(`${API_BASE_PATH}/budget-streams/${stream.id}`, stream);
    }

    deleteBudgetStream(id: string): Promise<boolean> {
        return this.api.delete(`${API_BASE_PATH}/budget-streams/${id}`);
    }

    // Spending
    fetchSpendingTotals(period: CalendarPeriod, asOfDate: string): Promise<SpendingTotal[]> {
        return this.api.load<SpendingTotal[]>(
            `${API_BASE_PATH}/transactions/spending?period=${period}&asOfDate=${asOfDate}`
        );
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
        if (options.direction) {
            params.append('direction', options.direction);
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
        if (options.includeHidden !== undefined) {
            params.append('includeHidden', options.includeHidden.toString());
        }

        return params;
    }
}
