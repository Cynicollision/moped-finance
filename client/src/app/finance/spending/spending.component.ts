import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { LowerCasePipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { CalendarPeriod, SortDirection } from '@shared/core/enum';
import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';
import { CategoryClass, TransactionsSortKey } from '@shared/finance/enum';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { ListColumn, ListModule } from './../../core/list/list.component';
import { DateProviderService } from './../../core/date-provider.service';
import { CardSkeletonComponent } from './../../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../../core/loading/load-error.component';
import { viewResource } from './../../core/loading/view-resource';
import { MoneyComponent, MoneyTone } from './../common/money.component';
import { FinanceService } from './../finance.service';

interface SpendingRow {
    /** The category or group ID, depending on the view mode; undefined for uncategorized transactions. */
    id?: string;
    name: string;
    /** As the card shows it: income, or spending as a positive number; negative when the net runs the other way (CASH-1.9). */
    amount: number;
}

@Component({
    selector: 'app-finance-spending',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        PercentPipe,
        LowerCasePipe,
        FormsModule,
        RouterLink,
        MatCardModule,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule,
        MatButtonToggleModule,
        MatIconModule,
        PageHeaderComponent,
        CardSkeletonComponent,
        LoadErrorComponent,
        ListModule,
        MoneyComponent
    ],
    templateUrl: './spending.component.html',
    styleUrl: './spending.component.scss'
})
export class FinanceSpendingComponent {
    private financeService = inject(FinanceService);
    private dateProvider = inject(DateProviderService);

    readonly CalendarPeriod = CalendarPeriod;
    readonly periods = [CalendarPeriod.Monthly, CalendarPeriod.Quarterly, CalendarPeriod.Yearly];
    readonly columns: ListColumn[] = [
        { key: 'name', label: 'Name', compact: 'primary' },
        { key: 'amount', label: 'Amount', width: '9rem', align: 'end', compact: 'trailing' }
    ];

    readonly months = [
        { value: 0, label: 'January' }, { value: 1, label: 'February' },
        { value: 2, label: 'March' }, { value: 3, label: 'April' },
        { value: 4, label: 'May' }, { value: 5, label: 'June' },
        { value: 6, label: 'July' }, { value: 7, label: 'August' },
        { value: 8, label: 'September' }, { value: 9, label: 'October' },
        { value: 10, label: 'November' }, { value: 11, label: 'December' }
    ];
    readonly quarters = [
        { value: 1, label: 'Q1' }, { value: 2, label: 'Q2' },
        { value: 3, label: 'Q3' }, { value: 4, label: 'Q4' }
    ];

    private readonly today = this.dateProvider.now();

    readonly selectedPeriod = signal(CalendarPeriod.Monthly);
    readonly selectedYear = signal(this.today.getFullYear());
    readonly selectedMonth = signal(this.today.getMonth());
    readonly selectedQuarter = signal(Math.floor(this.today.getMonth() / 3) + 1);
    readonly viewMode = signal<'category' | 'group'>('category');

    readonly lookups = viewResource({
        loader: async () => {
            // The oldest and newest transactions bound the years to choose from (CASH-1.1).
            const edgeTransaction = (sortDirection: SortDirection) => this.financeService.fetchTransactions({
                sortKey: TransactionsSortKey.Date, sortDirection, limit: 1, offset: 0
            });
            const [categories, groups, [first], [last]] = await Promise.all([
                this.financeService.fetchCategories(false),
                this.financeService.fetchCategoryGroups(),
                edgeTransaction(SortDirection.Asc),
                edgeTransaction(SortDirection.Desc)
            ]);
            return { categories, groups, firstDate: first?.date, lastDate: last?.date };
        }
    });

    /** Every year from the oldest transaction to the newest, and always the current one (CASH-1.1). */
    readonly years = computed(() => {
        const current = this.today.getFullYear();
        const yearOf = (date: CalendarDate | undefined) => date ? CalendarDateUtil.toDate(date).getFullYear() : current;
        const lookups = this.lookups.value();
        const from = Math.min(yearOf(lookups?.firstDate), current);
        const to = Math.max(yearOf(lookups?.lastDate), current);
        return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    });

    // The period's totals: reloads when the period changes, keeping the old ones on screen meanwhile.
    readonly totals = viewResource({
        params: () => ({ period: this.selectedPeriod(), asOfDate: this.getAsOfDate() }),
        loader: ({ period, asOfDate }) => this.financeService.fetchSpendingTotals(period, asOfDate)
    });

    private readonly categoryMap = computed(() => new Map((this.lookups.value()?.categories ?? []).map(c => [c.id, c])));
    private readonly groupMap = computed(() => new Map((this.lookups.value()?.groups ?? []).map(g => [g.id, g])));
    private readonly categoryTotals = computed(() => this.totals.value() ?? []);

    readonly error = computed(() => this.lookups.error() ?? this.totals.error());
    readonly isLoaded = computed(() => this.lookups.value() !== undefined && this.totals.value() !== undefined);

    retry() {
        this.lookups.reload();
        this.totals.reload();
    }

    private readonly rows = computed(() => {
        const viewMode = this.viewMode();
        const income = new Map<string, SpendingRow>();
        const expense = new Map<string, SpendingRow>();

        for (const total of this.categoryTotals()) {
            const cat = total.categoryId ? this.categoryMap().get(total.categoryId) : undefined;
            const group = cat ? this.groupMap().get(cat.groupId) : undefined;

            if (group?.class === CategoryClass.Transfer) {
                continue;
            }

            const id = viewMode === 'category' ? cat?.id : group?.id;
            const name = viewMode === 'category'
                ? (cat ? `${cat.icon} ${cat.name}` : 'Uncategorized')
                : (group?.name || 'Uncategorized');

            // Spending is money out, so an expense row counts amounts the other way round.
            const isIncome = group?.class === CategoryClass.Income;
            const rows = isIncome ? income : expense;
            const row = rows.get(id ?? '') ?? { id, name, amount: 0 };
            row.amount += isIncome ? total.amount : -total.amount;
            rows.set(id ?? '', row);
        }

        const largestFirst = (a: SpendingRow, b: SpendingRow) => b.amount - a.amount;
        return {
            income: [...income.values()].sort(largestFirst),
            expense: [...expense.values()].sort(largestFirst)
        };
    });

    private readonly incomeRows = computed(() => this.rows().income);
    private readonly expenseRows = computed(() => this.rows().expense);

    // Income is green and expenses the ordinary colour (APP-6.1).
    readonly sections = computed<{ title: string, rows: SpendingRow[], tone: MoneyTone }[]>(() => [
        { title: 'Income', rows: this.incomeRows(), tone: 'favourable' },
        { title: 'Expenses', rows: this.expenseRows(), tone: 'plain' }
    ]);

    readonly totalIncome = computed(() => this.incomeRows().reduce((sum, row) => sum + row.amount, 0));
    readonly totalExpenses = computed(() => this.expenseRows().reduce((sum, row) => sum + row.amount, 0));
    readonly totalSavings = computed(() => this.totalIncome() - this.totalExpenses());
    readonly savingsRate = computed(() => this.totalIncome() > 0 ? this.totalSavings() / this.totalIncome() : 0);

    /** The first day of the selected period. */
    private getAsOfDate(): CalendarDate {
        switch (this.selectedPeriod()) {
            case CalendarPeriod.Monthly:
                return CalendarDateUtil.fromDate(new Date(this.selectedYear(), this.selectedMonth(), 1));
            case CalendarPeriod.Quarterly:
                return CalendarDateUtil.fromDate(new Date(this.selectedYear(), (this.selectedQuarter() - 1) * 3, 1));
            default:
                return CalendarDateUtil.fromDate(new Date(this.selectedYear(), 0, 1));
        }
    }

    /** The Transactions filters for a row: its category or group, and the period (CASH-1.6). */
    rowQueryParams(row: SpendingRow): Record<string, string> {
        const queryParams: Record<string, string> = {};

        if (this.viewMode() === 'category' && row.id) {
            queryParams['categoryId'] = row.id;
        }
        else if (this.viewMode() === 'group' && row.id) {
            queryParams['group'] = row.id;
        }

        // The same period the server totalled (CASH-1.6).
        const { startDate, endDate } = CalendarDateUtil.getPeriod(this.selectedPeriod(), this.getAsOfDate());
        queryParams['startDate'] = startDate;
        queryParams['endDate'] = endDate;
        return queryParams;
    }
}
