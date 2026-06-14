import { Component, ViewChild, AfterViewInit, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl } from '@angular/forms';
import { MatTableDataSource, MatTableModule } from '@angular/material/table';
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
import { MatSelectModule } from '@angular/material/select';
import { startWith, map } from 'rxjs';
import { SortDirection } from '@shared/core/enum';
import { TransactionSearchOptions } from '@shared/finance/contracts';
import { TransactionsFilterKey, TransactionsSortKey } from '@shared/finance/enum';
import { Transaction, Category, Account, CategoryGroup } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-transactions',
    standalone: true,
    imports: [
        CommonModule,
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
        MatMenuModule
    ],
    templateUrl: './transactions.component.html',
    styleUrl: './transactions.component.scss'
})
export class FinanceTransactionsComponent implements OnInit, AfterViewInit {
    private financeService = inject(FinanceService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private dateProvider = inject(DateProviderService);
    protected readonly Math = Math;

    displayedColumns: string[] = ['date', 'account', 'merchant', 'category', 'amount'];
    dataSource = new MatTableDataSource<Transaction>([]);
    pageSize = 25;
    hasMoreData = true;
    loaded = false;

    @ViewChild(MatSort) sort!: MatSort;

    filterForm = new FormGroup({
        minAmount: new FormControl<number | null>(null),
        maxAmount: new FormControl<number | null>(null),
        startDate: new FormControl<Date | null>(null),
        endDate: new FormControl<Date | null>(this.dateProvider.now()),
        merchant: new FormControl<string>(''),
        category: new FormControl<string>(''),
        account: new FormControl<string>(''),
        group: new FormControl<string>('')
    });

    merchants = signal<string[]>([]);
    categories = signal<Category[]>([]);
    groups = signal<CategoryGroup[]>([]);
    categoryMap = new Map<string, Category>();
    groupMap = new Map<string, CategoryGroup>();
    accounts = signal<Account[]>([]);
    accountMap = new Map<string, Account>();

    filteredMerchants = signal<string[]>([]);
    filteredCategories = signal<Category[]>([]);
    filteredGroups = signal<CategoryGroup[]>([]);

    constructor() {
    }

    async ngOnInit() {
        const [merchants, categories, accounts, groups] = await Promise.all([
            this.financeService.fetchTransactionMerchants(),
            this.financeService.fetchCategories(false),
            this.financeService.fetchAllAccounts(),
            this.financeService.fetchCategoryGroups()
        ]);

        this.merchants.set(merchants || []);
        this.categories.set(categories || []);
        this.categories().forEach(c => this.categoryMap.set(c.id, c));
        this.groups.set(groups || []);
        this.groups().forEach(g => this.groupMap.set(g.id, g));
        this.accounts.set(accounts || []);
        this.accounts().forEach(a => this.accountMap.set(a.id, a));

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

        const patch: any = {};
        if (accountId) {
            patch.account = accountId;
        }
        if (categoryId) {
            patch.category = categoryId;
        }
        if (group) {
            patch.group = group;
        }
        if (startDateStr) {
            const date = new Date(startDateStr);
            if (!isNaN(date.getTime())) {
                patch.startDate = date;
            }
        }
        if (endDateStr) {
            const date = new Date(endDateStr);
            if (!isNaN(date.getTime())) {
                patch.endDate = date;
            }
        }

        if (Object.keys(patch).length > 0) {
            this.filterForm.patchValue(patch);
        }

        this.sort.sortChange.subscribe(() => this.loadData(true));
        this.sort.sort({ id: 'date', start: 'desc', disableClear: false });
    }

    async loadData(reset: boolean = false) {
        if (reset) {
            this.dataSource.data = [];
            this.hasMoreData = true;
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

        let sortKey: string | undefined;
        let sortDirection: string | undefined;

        if (this.sort) {
            if (this.sort.direction === 'asc') {
                sortDirection = SortDirection.Asc;
            } else if (this.sort.direction === 'desc') {
                sortDirection = SortDirection.Desc;
            }

            switch (this.sort.active) {
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
                    sortKey = TransactionsSortKey.AccountId;
                    break;
                case 'category':
                    sortKey = TransactionsSortKey.CategoryId;
                    break;
            }
        }

        const options: TransactionSearchOptions = {
            limit: this.pageSize,
            offset: this.dataSource.data.length,
            minAmount: formValues.minAmount ?? undefined,
            maxAmount: formValues.maxAmount ?? undefined,
            startDate: formValues.startDate?.toISOString(),
            endDate: formValues.endDate?.toISOString(),
            filters: filters.length > 0 ? filters : undefined,
            sortKey,
            sortDirection
        };

        const newTransactions: Transaction[] = await this.financeService.fetchTransactions(options) || [];

        this.hasMoreData = newTransactions.length === this.pageSize;

        if (reset) {
            this.dataSource.data = newTransactions;
        } else {
            this.dataSource.data = [...this.dataSource.data, ...newTransactions];
        }

        this.loaded = true;
    }

    async loadMore() {
        await this.loadData();
    }

    onRowClick(row: Transaction) {
        this.router.navigate([row.id], { relativeTo: this.route });
    }

    getCategoryName(id: string): string {
        const category = this.categoryMap.get(id);
        return category ? `${category.icon} ${category.name}` : id;
    }

    getAccountName(id: string): string {
        const account = this.accountMap.get(id);
        return account ? account.name : id;
    }

    readonly displayCategory = (id: string): string => this.getCategoryName(id);

    readonly displayGroup = (id: string): string => {
        const group = this.groupMap.get(id);
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