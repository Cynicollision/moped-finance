import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
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
import { CashflowStream } from '@shared/finance/contracts';
import { CategoryClass } from '@shared/finance/enum';
import { Category, CategoryGroup } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
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
        MatIconModule
    ],
    templateUrl: './cashflow.component.html',
    styleUrl: './cashflow.component.scss'
})
export class FinanceCashflowComponent implements OnInit {
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

    private readonly categoryMap = signal(new Map<string, Category>());
    private readonly groupMap = signal(new Map<string, CategoryGroup>());
    private readonly cashflowStreams = signal<CashflowStream[]>([]);

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

    async ngOnInit() {
        const [categories, groups] = await Promise.all([
            this.financeService.fetchCategories(false),
            this.financeService.fetchCategoryGroups()
        ]);
        this.categoryMap.set(new Map((categories || []).map(c => [c.id, c])));
        this.groupMap.set(new Map((groups || []).map(g => [g.id, g])));

        await this.loadData();
    }

    async loadData() {
        const asOfDate = this.getAsOfDate();
        const streams = await this.financeService.fetchCashflowStreams(this.selectedPeriod(), asOfDate.toISOString().split('T')[0]);
        this.cashflowStreams.set(streams || []);
    }

    private getAsOfDate(): Date {
        switch (this.selectedPeriod()) {
            case CalendarPeriod.Monthly:
                return new Date(this.selectedYear(), this.selectedMonth(), 1);
            case CalendarPeriod.Quarterly:
                return new Date(this.selectedYear(), (this.selectedQuarter() - 1) * 3, 1);
            default:
                return new Date(this.selectedYear(), 0, 1);
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

        const asOfDate = this.getAsOfDate();
        const startDate = new Date(asOfDate.getTime());
        const endDate = new Date(asOfDate.getTime());

        switch (this.selectedPeriod()) {
            case CalendarPeriod.Monthly:
                startDate.setDate(1);
                endDate.setMonth(endDate.getMonth() + 1, 0);
                break;
            case CalendarPeriod.Quarterly:
                startDate.setDate(1);
                endDate.setMonth(endDate.getMonth() + 3, 0);
                break;
            case CalendarPeriod.Yearly:
                startDate.setMonth(0, 1);
                endDate.setMonth(11, 31);
                break;
        }

        queryParams['startDate'] = startDate.toISOString().split('T')[0];
        queryParams['endDate'] = endDate.toISOString().split('T')[0];

        this.router.navigate(['/transactions'], { queryParams });
    }
}
