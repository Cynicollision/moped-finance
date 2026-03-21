import { Component, ViewChild, AfterViewInit, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
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
import { MatSelectModule } from '@angular/material/select';
import { SortDirection } from '@shared/core/enum';
import { GetTransactionsOptions } from '@shared/finance/contracts';
import { TransactionsFilterKey, TransactionsSortKey } from '@shared/finance/enum';
import { Transaction, Category, Account } from '@shared/finance/types';
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
        MatSelectModule
    ],
    templateUrl: './transactions.component.html',
    styleUrl: './transactions.component.scss'
})
export class FinanceTransactionsComponent implements OnInit, AfterViewInit {
    private financeService = inject(FinanceService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    protected readonly Math = Math;

    displayedColumns: string[] = ['date', 'account', 'merchant', 'category', 'amount'];
    dataSource = new MatTableDataSource<Transaction>([]);
    pageSize = 25;
    hasMoreData = true;

    @ViewChild(MatSort) sort!: MatSort;

    filterForm = new FormGroup({
        minAmount: new FormControl<number | null>(null),
        maxAmount: new FormControl<number | null>(null),
        startDate: new FormControl<Date | null>(null),
        endDate: new FormControl<Date | null>(new Date()),
        merchant: new FormControl<string>(''),
        category: new FormControl<string>(''),
        account: new FormControl<string>('')
    });

    merchants: string[] = [];
    categories: Category[] = [];
    categoryMap = new Map<string, Category>();
    accounts: Account[] = [];
    accountMap = new Map<string, Account>();

    constructor() {
    }

    async ngOnInit() {
        const [merchants, categories, accounts] = await Promise.all([
            this.financeService.fetchTransactionMerchants(),
            this.financeService.fetchCategories(false),
            this.financeService.fetchAccounts()
        ]);

        this.merchants = merchants || [];
        this.categories = categories || [];
        this.categories.forEach(c => this.categoryMap.set(c.id, c));
        this.accounts = accounts || [];
        this.accounts.forEach(a => this.accountMap.set(a.id, a));
    }

    ngAfterViewInit() {
        const accountId = this.route.snapshot.queryParamMap.get('accountId');
        if (accountId) {
            this.filterForm.patchValue({ account: accountId });
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

        const options: GetTransactionsOptions = {
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

    clearFilters() {
        this.filterForm.reset({
            minAmount: null,
            maxAmount: null,
            startDate: null,
            endDate: new Date(),
            merchant: '',
            category: '',
            account: ''
        });
        this.loadData(true);
    }
}