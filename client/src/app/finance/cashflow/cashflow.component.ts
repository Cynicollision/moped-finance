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

interface CashflowRow {
    /** The category or group ID, depending on the view mode; undefined for uncategorized transactions. */
    id?: string;
    name: string;
    /** As the card shows it: income, or spending as a positive number; negative when the net runs the other way (CASH-1.9). */
    amount: number;
}

@Component({
    selector: 'app-finance-cashflow',
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
    templateUrl: './cashflow.component.html',
    styleUrl: './cashflow.component.scss'
})
export class FinanceCashflowComponent {
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
    readonly streams = viewResource({
        params: () => ({ period: this.selectedPeriod(), asOfDate: this.getAsOfDate() }),
        loader: ({ period, asOfDate }) => this.financeService.fetchCashflowStreams(period, asOfDate)
    });

    private readonly categoryMap = computed(() => new Map((this.lookups.value()?.categories ?? []).map(c => [c.id, c])));
    private readonly groupMap = computed(() => new Map((this.lookups.value()?.groups ?? []).map(g => [g.id, g])));
    private readonly cashflowStreams = computed(() => this.streams.value() ?? []);

    readonly error = computed(() => this.lookups.error() ?? this.streams.error());
    readonly isLoaded = computed(() => this.lookups.value() !== undefined && this.streams.value() !== undefined);

    retry() {
        this.lookups.reload();
        this.streams.reload();
    }

    private readonly rows = computed(() => {
        const viewMode = this.viewMode();
        const income = new Map<string, CashflowRow>();
        const expense = new Map<string, CashflowRow>();

        for (const stream of this.cashflowStreams()) {
            const cat = stream.categoryId ? this.categoryMap().get(stream.categoryId) : undefined;
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
            row.amount += isIncome ? stream.amount : -stream.amount;
            rows.set(id ?? '', row);
        }

        const largestFirst = (a: CashflowRow, b: CashflowRow) => b.amount - a.amount;
        return {
            income: [...income.values()].sort(largestFirst),
            expense: [...expense.values()].sort(largestFirst)
        };
    });

    private readonly incomeStreams = computed(() => this.rows().income);
    private readonly expenseStreams = computed(() => this.rows().expense);

    // Income is green and expenses the ordinary colour (APP-6.1).
    readonly sections = computed<{ title: string, rows: CashflowRow[], tone: MoneyTone }[]>(() => [
        { title: 'Income', rows: this.incomeStreams(), tone: 'favourable' },
        { title: 'Expenses', rows: this.expenseStreams(), tone: 'plain' }
    ]);

    readonly totalIncome = computed(() => this.incomeStreams().reduce((sum, row) => sum + row.amount, 0));
    readonly totalExpenses = computed(() => this.expenseStreams().reduce((sum, row) => sum + row.amount, 0));
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
    rowQueryParams(row: CashflowRow): Record<string, string> {
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
