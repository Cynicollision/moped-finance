import { ChangeDetectionStrategy, Component, AfterViewInit, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatSort, MatSortModule } from '@angular/material/sort';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatSelectModule } from '@angular/material/select';
import { startWith, map } from 'rxjs';
import { SortDirection } from '@shared/core/enum';
import { CalendarDateUtil } from '@shared/core/util';
import { TransactionSearchOptions } from '@shared/finance/contracts';
import { TransactionsFilterKey, TransactionsSortKey } from '@shared/finance/enum';
import { Transaction, Category, Account, CategoryGroup } from '@shared/finance/types';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { DateProviderService } from './../../core/date-provider.service';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-transactions',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CurrencyPipe,
        DatePipe,
        ReactiveFormsModule,
        MatTableModule,
        MatSortModule,
        MatButtonModule,
        MatIconModule,
        MatExpansionModule,
        MatFormFieldModule,
        MatInputModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatAutocompleteModule,
        MatSelectModule,
        RouterModule,
        MatMenuModule,
        MatDividerModule,
        PageHeaderComponent
    ],
    templateUrl: './transactions.component.html',
    styleUrl: './transactions.component.scss'
})
export class FinanceTransactionsComponent implements OnInit, AfterViewInit {
    private financeService = inject(FinanceService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private dateProvider = inject(DateProviderService);
    readonly Math = Math;

    readonly displayedColumns: string[] = ['date', 'account', 'merchant', 'category', 'amount'];
    private readonly pageSize = 25;
    readonly transactions = signal<Transaction[]>([]);
    readonly hasMoreData = signal(true);
    readonly loaded = signal(false);

    readonly sort = viewChild.required(MatSort);

    readonly filterForm = new FormGroup({
        minAmount: new FormControl<number | null>(null),
        maxAmount: new FormControl<number | null>(null),
        startDate: new FormControl<Date | null>(null),
        endDate: new FormControl<Date | null>(this.dateProvider.now()),
        merchant: new FormControl<string>(''),
        category: new FormControl<string>(''),
        account: new FormControl<string>(''),
        group: new FormControl<string>('')
    });

    readonly merchants = signal<string[]>([]);
    readonly categories = signal<Category[]>([]);
    readonly groups = signal<CategoryGroup[]>([]);
    readonly accounts = signal<Account[]>([]);
    private readonly categoryMap = computed(() => new Map(this.categories().map(c => [c.id, c])));
    private readonly groupMap = computed(() => new Map(this.groups().map(g => [g.id, g])));
    private readonly accountMap = computed(() => new Map(this.accounts().map(a => [a.id, a])));

    readonly filteredMerchants = signal<string[]>([]);
    readonly filteredCategories = signal<Category[]>([]);
    readonly filteredGroups = signal<CategoryGroup[]>([]);

    async ngOnInit() {
        const [merchants, categories, accounts, groups] = await Promise.all([
            this.financeService.fetchTransactionMerchants(),
            this.financeService.fetchCategories(false),
            this.financeService.fetchAllAccounts(),
            this.financeService.fetchCategoryGroups()
        ]);

        this.merchants.set(merchants || []);
        this.categories.set(categories || []);
        this.groups.set(groups || []);
        this.accounts.set(accounts || []);

        // Setup filter observers
        this.setupTypeaheadFilters();
    }

    private setupTypeaheadFilters() {
        const _filterMerchants = (value: string): string[] => {
            const filterValue = value.toLowerCase();
            return this.merchants().filter(m => m.toLowerCase().includes(filterValue));
        };

        const _filterCategories = (value: string): Category[] => {
            const filterValue = value.toLowerCase();
            return this.categories().filter(c => c.name.toLowerCase().includes(filterValue));
        };

        const _filterGroups = (value: string): CategoryGroup[] => {
            const filterValue = value.toLowerCase();
            return this.groups().filter(g => g.name.toLowerCase().includes(filterValue));
        };

        // Merchant Filter
        this.filterForm.controls.merchant.valueChanges.pipe(
            startWith(''),
            map(value => _filterMerchants(value || ''))
        ).subscribe(filtered => this.filteredMerchants.set(filtered));

        // Category Filter
        this.filterForm.controls.category.valueChanges.pipe(
            startWith(''),
            map(value => typeof value === 'string' ? value : ''),
            map(name => _filterCategories(name))
        ).subscribe(filtered => this.filteredCategories.set(filtered));

        // Group Filter
        this.filterForm.controls.group.valueChanges.pipe(
            startWith(''),
            map(value => typeof value === 'string' ? value : ''),
            map(name => _filterGroups(name))
        ).subscribe(filtered => this.filteredGroups.set(filtered));
    }

    ngAfterViewInit() {
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

        this.sort().sortChange.subscribe(() => this.loadData(true));

        Promise.resolve().then(() => {
            this.sort().sort({ id: 'date', start: 'desc', disableClear: false });
        });
    }

    async loadData(reset = false) {
        if (reset) {
            this.transactions.set([]);
            this.hasMoreData.set(true);
        }

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

        let sortKey: TransactionsSortKey | undefined;
        let sortDirection: SortDirection | undefined;

        const sort = this.sort();
        if (sort.direction === 'asc') {
            sortDirection = SortDirection.Asc;
        }
        else if (sort.direction === 'desc') {
            sortDirection = SortDirection.Desc;
        }

        switch (sort.active) {
            case 'date':
                sortKey = TransactionsSortKey.Date;
                break;
            case 'merchant':
                sortKey = TransactionsSortKey.Merchant;
                break;
            case 'amount':
                sortKey = TransactionsSortKey.Amount;
                break;
            case 'account':
                sortKey = TransactionsSortKey.Account;
                break;
            case 'category':
                sortKey = TransactionsSortKey.Category;
                break;
        }

        const options: TransactionSearchOptions = {
            limit: this.pageSize,
            offset: this.transactions().length,
            minAmount: formValues.minAmount ?? undefined,
            maxAmount: formValues.maxAmount ?? undefined,
            startDate: formValues.startDate ? CalendarDateUtil.fromDate(formValues.startDate) : undefined,
            endDate: formValues.endDate ? CalendarDateUtil.fromDate(formValues.endDate) : undefined,
            filters: filters.length > 0 ? filters : undefined,
            sortKey,
            sortDirection
        };

        const newTransactions: Transaction[] = await this.financeService.fetchTransactions(options) || [];

        this.hasMoreData.set(newTransactions.length === this.pageSize);
        this.transactions.update(current => reset ? newTransactions : [...current, ...newTransactions]);
        this.loaded.set(true);
    }

    async loadMore() {
        await this.loadData();
    }

    onRowClick(row: Transaction) {
        this.router.navigate([row.id], { relativeTo: this.route });
    }

    getCategoryName(id: string): string {
        const category = this.categoryMap().get(id);
        return category ? `${category.icon} ${category.name}` : id;
    }

    getAccountName(id: string): string {
        const account = this.accountMap().get(id);
        return account ? account.name : id;
    }

    readonly displayCategory = (id: string): string => this.getCategoryName(id);

    readonly displayGroup = (id: string): string => {
        const group = this.groupMap().get(id);
        return group ? group.name : '';
    };

    clearFilters() {
        this.filterForm.reset({
            minAmount: null,
            maxAmount: null,
            startDate: null,
            endDate: this.dateProvider.now(),
            merchant: '',
            category: '',
            account: '',
            group: ''
        });
        this.loadData(true);
    }

    downloadTransactions() {
        const formValues = this.filterForm.value;
        const accountId = formValues.account || undefined;
        const url = this.financeService.getExportTransactionsUrl(accountId);
        window.open(url, '_blank');
    }
}
