import {
    ChangeDetectionStrategy,
    Component,
    TemplateRef,
    computed,
    inject,
    linkedSignal,
    signal,
    viewChild
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatBottomSheet, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { SortDirection } from '@shared/core/enum';
import { CalendarDateUtil } from '@shared/core/util';
import { TransactionSearchOptions } from '@shared/finance/contracts';
import { TransactionDirection, TransactionsFilterKey, TransactionsSortKey } from '@shared/finance/enum';
import { Transaction } from '@shared/finance/types';
import { Uncategorized } from '@shared/finance/util';
import { LayoutService } from './../core/layout/layout.service';
import { PageHeaderComponent } from './../core/layout/page-header.component';
import { ListColumn, ListModule, ListSort } from './../core/list/list.component';
import { describeRequestError } from './../core/api.service';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { SkeletonComponent } from './../core/loading/skeleton.component';
import { viewResource } from './../core/loading/view-resource';
import { NotificationService } from './../core/notification.service';
import { categoryLabel } from './../common/category-label';
import { MoneyComponent } from './../common/money.component';
import { FinanceService } from './../common/finance.service';

@Component({
    selector: 'app-transactions',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        NgTemplateOutlet,
        ReactiveFormsModule,
        MatBadgeModule,
        MatButtonModule,
        MatCheckboxModule,
        MatIconModule,
        MatExpansionModule,
        MatFormFieldModule,
        MatInputModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatAutocompleteModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        RouterModule,
        MatMenuModule,
        MatDividerModule,
        PageHeaderComponent,
        LoadErrorComponent,
        SkeletonComponent,
        ListModule,
        MoneyComponent
    ],
    templateUrl: './transactions.component.html',
    styleUrl: './transactions.component.scss'
})
export class TransactionsComponent {
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);
    private notificationService = inject(NotificationService);
    private bottomSheet = inject(MatBottomSheet);
    readonly isCompact = inject(LayoutService).isCompact;
    readonly Uncategorized = Uncategorized;
    readonly Direction = TransactionDirection;

    private readonly pageSize = 25;

    // Wide: every column. Narrow: merchant and amount, with the date and category under the merchant (TXN-1.9).
    readonly columns: ListColumn[] = [
        { key: 'date', label: 'Date', width: '8rem', sort: 'desc', compact: 'secondary' },
        { key: 'account', label: 'Account', sort: 'asc' },
        { key: 'merchant', label: 'Merchant', width: 'minmax(0, 1.5fr)', sort: 'asc', compact: 'primary' },
        { key: 'category', label: 'Category', sort: 'asc', compact: 'secondary' },
        { key: 'amount', label: 'Amount', width: '9rem', align: 'end', sort: 'asc', compact: 'trailing' }
    ];
    private readonly sortKeys: Record<string, TransactionsSortKey> = {
        date: TransactionsSortKey.Date,
        account: TransactionsSortKey.Account,
        merchant: TransactionsSortKey.Merchant,
        category: TransactionsSortKey.Category,
        amount: TransactionsSortKey.Amount
    };
    /** Newest first by default (TXN-1.2). */
    readonly sort = signal<ListSort>({ key: 'date', direction: 'desc' });

    private readonly filtersSheet = viewChild.required<TemplateRef<unknown>>('filtersSheet');
    private filtersSheetRef?: MatBottomSheetRef;

    readonly filterForm = new FormGroup({
        // Sizes, ignoring the sign; direction narrows by sign (TXN-1.14). '' is Any.
        minAmount: new FormControl<number | null>(null),
        maxAmount: new FormControl<number | null>(null),
        direction: new FormControl<TransactionDirection | ''>(''),
        startDate: new FormControl<Date | null>(null),
        endDate: new FormControl<Date | null>(null),
        merchant: new FormControl<string>(''),
        category: new FormControl<string>(''),
        account: new FormControl<string>(''),
        group: new FormControl<string>(''),
        // Hidden transactions are left out unless asked for (TXN-1.8, TXN-1.13).
        showHidden: new FormControl<boolean>(false, { nonNullable: true })
    });

    // The filters' choices, and the names shown in the list.
    readonly lookups = viewResource({
        loader: async () => {
            const [merchants, categories, accounts, groups] = await Promise.all([
                this.financeService.fetchTransactionMerchants(),
                this.financeService.fetchCategories(false),
                this.financeService.fetchAllAccounts(),
                this.financeService.fetchCategoryGroups()
            ]);
            return { merchants, categories, accounts, groups };
        }
    });
    readonly merchants = computed(() => this.lookups.value()?.merchants ?? []);
    readonly categories = computed(() => this.lookups.value()?.categories ?? []);
    readonly groups = computed(() => this.lookups.value()?.groups ?? []);
    readonly accounts = computed(() => this.lookups.value()?.accounts ?? []);
    /** The Account filter's choices: hidden accounts only when the screen was opened filtered to one (TXN-1.12). */
    readonly accountOptions = computed(() => {
        const openedFor = this.route.snapshot.queryParamMap.get('accountId');
        return this.accounts().filter(a => !a.isHidden || a.id === openedFor);
    });
    private readonly categoryMap = computed(() => new Map(this.categories().map(c => [c.id, c])));
    private readonly groupMap = computed(() => new Map(this.groups().map(g => [g.id, g])));
    private readonly accountMap = computed(() => new Map(this.accounts().map(a => [a.id, a])));

    // What's typed in the filters' autocompletes. A chosen category or group is its ID, not text to match.
    private readonly merchantText = toSignal(this.filterForm.controls.merchant.valueChanges, { initialValue: '' });
    private readonly categoryText = toSignal(this.filterForm.controls.category.valueChanges, { initialValue: '' });
    private readonly groupText = toSignal(this.filterForm.controls.group.valueChanges, { initialValue: '' });

    readonly filteredMerchants = computed(() => {
        const text = (this.merchantText() || '').toLowerCase();
        return this.merchants().filter(m => m.toLowerCase().includes(text));
    });
    readonly filteredCategories = computed(() => {
        const text = (typeof this.categoryText() === 'string' ? this.categoryText()! : '').toLowerCase();
        return this.categories().filter(c => c.name.toLowerCase().includes(text));
    });
    /** Uncategorized can be filtered for like any category (TXN-1.11). */
    readonly offersUncategorized = computed(() => {
        const text = (typeof this.categoryText() === 'string' ? this.categoryText()! : '').toLowerCase();
        return Uncategorized.name.toLowerCase().includes(text);
    });
    readonly filteredGroups = computed(() => {
        const text = (typeof this.groupText() === 'string' ? this.groupText()! : '').toLowerCase();
        return this.groups().filter(g => g.name.toLowerCase().includes(text));
    });

    /** The search the list shows: set from the filters and sort when they're applied. */
    private readonly search = signal<TransactionSearchOptions | undefined>(undefined);

    // The first page reloads when the search changes, keeping the old list on screen meanwhile.
    readonly firstPage = viewResource({
        params: () => this.search(),
        loader: search => this.financeService.fetchTransactions({ ...search, limit: this.pageSize, offset: 0 })
    });

    // Pages added with Load More, and whether the last page was full; both reset with each new first page.
    private readonly morePages = linkedSignal<Transaction[] | undefined, Transaction[]>({
        source: () => this.firstPage.value(),
        computation: () => []
    });
    private readonly lastPageFull = linkedSignal(() => this.firstPage.value()?.length === this.pageSize);
    readonly loadingMore = signal(false);

    readonly transactions = computed(() => [...(this.firstPage.value() ?? []), ...this.morePages()]);
    readonly hasMoreData = computed(() => this.lastPageFull());
    readonly isLoaded = computed(() => this.firstPage.value() !== undefined);
    readonly isRefreshing = computed(() => this.firstPage.isRefreshing() || this.lookups.isRefreshing());

    constructor() {
        const queryParams = this.route.snapshot.queryParamMap;
        const accountId = queryParams.get('accountId');
        const categoryId = queryParams.get('categoryId');
        const group = queryParams.get('group');
        const startDateStr = queryParams.get('startDate');
        const endDateStr = queryParams.get('endDate');

        const patch: Partial<typeof this.filterForm.value> = {};
        if (accountId) {
            patch.account = accountId;
        }
        if (categoryId) {
            patch.category = categoryId;
        }
        if (group) {
            patch.group = group;
        }
        if (startDateStr && CalendarDateUtil.isValid(startDateStr)) {
            patch.startDate = CalendarDateUtil.toDate(startDateStr);
        }
        if (endDateStr && CalendarDateUtil.isValid(endDateStr)) {
            patch.endDate = CalendarDateUtil.toDate(endDateStr);
        }

        if (Object.keys(patch).length > 0) {
            this.filterForm.patchValue(patch);
        }

        this.applySearch();
    }

    /** How many filters the list is narrowed by (TXN-1.5). */
    readonly activeFilterCount = computed(() => {
        const search = this.search();
        if (!search) {
            return 0;
        }
        const set = [search.minAmount, search.maxAmount, search.direction, search.startDate, search.endDate].filter(
            v => v !== undefined
        ).length;
        return set + (search.filters?.length ?? 0) + (search.includeHidden ? 1 : 0);
    });

    onSortChange(sort: ListSort) {
        this.sort.set(sort);
        this.applySearch();
    }

    openFilters() {
        this.filtersSheetRef = this.bottomSheet.open(this.filtersSheet(), {
            ariaLabel: 'Filters',
            autoFocus: 'dialog'
        });
    }

    applyFilters() {
        this.applySearch();
        this.filtersSheetRef?.dismiss();
    }

    /** Searches with the current filters and sort (TXN-1.7). */
    applySearch() {
        const formValues = this.filterForm.value;
        const filters = [];

        if (formValues.merchant) {
            filters.push({ key: TransactionsFilterKey.Merchant, value: formValues.merchant });
        }
        if (formValues.category) {
            filters.push({ key: TransactionsFilterKey.Category, value: formValues.category });
        }
        if (formValues.account) {
            filters.push({ key: TransactionsFilterKey.AccountId, value: formValues.account });
        }
        if (formValues.group) {
            filters.push({ key: TransactionsFilterKey.Group, value: formValues.group });
        }

        const sort = this.sort();
        this.search.set({
            minAmount: formValues.minAmount ?? undefined,
            maxAmount: formValues.maxAmount ?? undefined,
            direction: formValues.direction || undefined,
            startDate: formValues.startDate ? CalendarDateUtil.fromDate(formValues.startDate) : undefined,
            endDate: formValues.endDate ? CalendarDateUtil.fromDate(formValues.endDate) : undefined,
            filters: filters.length > 0 ? filters : undefined,
            includeHidden: formValues.showHidden || undefined,
            sortKey: this.sortKeys[sort.key],
            sortDirection: sort.direction === 'asc' ? SortDirection.Asc : SortDirection.Desc
        });
    }

    async loadMore() {
        const search = this.search();
        if (!search || this.loadingMore()) {
            return;
        }

        this.loadingMore.set(true);
        try {
            const page = await this.financeService.fetchTransactions({
                ...search,
                limit: this.pageSize,
                offset: this.transactions().length
            });
            this.morePages.update(pages => [...pages, ...page]);
            this.lastPageFull.set(page.length === this.pageSize);
        } catch (error) {
            this.notificationService.error(describeRequestError(error));
        } finally {
            this.loadingMore.set(false);
        }
    }

    /** A transaction with no category, and the filter for those, read Uncategorized (CAT-5). */
    getCategoryName(id: string): string {
        if (!id || id === Uncategorized.filterValue) {
            return Uncategorized.name;
        }
        const category = this.categoryMap().get(id);
        return category ? categoryLabel(category) : id;
    }

    getAccountName(id: string): string {
        const account = this.accountMap().get(id);
        return account ? account.name : id;
    }

    // An empty filter shows nothing, rather than Uncategorized.
    readonly displayCategory = (id: string): string => (id ? this.getCategoryName(id) : '');

    readonly displayGroup = (id: string): string => {
        const group = this.groupMap().get(id);
        return group ? group.name : '';
    };

    clearFilters() {
        this.filterForm.reset({
            minAmount: null,
            maxAmount: null,
            direction: '',
            startDate: null,
            endDate: null,
            merchant: '',
            category: '',
            account: '',
            group: '',
            showHidden: false
        });
        this.applyFilters();
    }

    downloadTransactions() {
        const formValues = this.filterForm.value;
        const accountId = formValues.account || undefined;
        const url = this.financeService.getExportTransactionsUrl(accountId);
        window.open(url, '_blank');
    }
}
