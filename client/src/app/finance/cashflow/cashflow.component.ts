import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, LowerCasePipe, PercentPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { CalendarPeriod } from '@shared/core/enum';
import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';
import { CategoryClass } from '@shared/finance/enum';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { DateProviderService } from './../../core/date-provider.service';
import { CardSkeletonComponent } from './../../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../../core/loading/load-error.component';
import { viewResource } from './../../core/loading/view-resource';
import { FinanceService } from './../finance.service';

interface CashflowRow {
    /** The category or group ID, depending on the view mode; undefined for uncategorized transactions. */
    id?: string;
    name: string;
    amount: number;
}

@Component({
    selector: 'app-finance-cashflow',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CurrencyPipe,
        PercentPipe,
        LowerCasePipe,
        FormsModule,
        MatCardModule,
        MatFormFieldModule,
        MatSelectModule,
        MatButtonModule,
        MatButtonToggleModule,
        MatTableModule,
        MatIconModule,
        PageHeaderComponent,
        CardSkeletonComponent,
        LoadErrorComponent
    ],
    templateUrl: './cashflow.component.html',
    styleUrl: './cashflow.component.scss'
})
export class FinanceCashflowComponent {
    private financeService = inject(FinanceService);
    private router = inject(Router);
    private dateProvider = inject(DateProviderService);

    readonly CalendarPeriod = CalendarPeriod;
    readonly Math = Math;
    readonly periods = [CalendarPeriod.Monthly, CalendarPeriod.Quarterly, CalendarPeriod.Yearly];
    readonly displayedColumns: string[] = ['name', 'amount'];

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
    readonly years = [this.today.getFullYear() - 2, this.today.getFullYear() - 1, this.today.getFullYear(), this.today.getFullYear() + 1];

    readonly selectedPeriod = signal(CalendarPeriod.Monthly);
    readonly selectedYear = signal(this.today.getFullYear());
    readonly selectedMonth = signal(this.today.getMonth());
    readonly selectedQuarter = signal(Math.floor(this.today.getMonth() / 3) + 1);
    readonly viewMode = signal<'category' | 'group'>('category');

    readonly lookups = viewResource({
        loader: async () => {
            const [categories, groups] = await Promise.all([
                this.financeService.fetchCategories(false),
                this.financeService.fetchCategoryGroups()
            ]);
            return { categories, groups };
        }
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

            const rows = group?.class === CategoryClass.Income ? income : expense;
            const row = rows.get(id ?? '') ?? { id, name, amount: 0 };
            row.amount += stream.amount;
            rows.set(id ?? '', row);
        }

        const sortByAmountDesc = (a: CashflowRow, b: CashflowRow) => Math.abs(b.amount) - Math.abs(a.amount);
        return {
            income: [...income.values()].sort(sortByAmountDesc),
            expense: [...expense.values()].sort(sortByAmountDesc)
        };
    });

    private readonly incomeStreams = computed(() => this.rows().income);
    private readonly expenseStreams = computed(() => this.rows().expense);

    readonly sections = computed(() => [
        { title: 'Income', rows: this.incomeStreams() },
        { title: 'Expenses', rows: this.expenseStreams() }
    ]);

    readonly totalIncome = computed(() => this.incomeStreams().reduce((sum, row) => sum + row.amount, 0));
    readonly totalExpenses = computed(() => this.expenseStreams().reduce((sum, row) => sum + Math.abs(row.amount), 0));
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

    onRowClick(row: CashflowRow) {
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

        this.router.navigate(['/transactions'], { queryParams });
    }
}
