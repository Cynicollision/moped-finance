import { ChangeDetectionStrategy, Component, ElementRef, TemplateRef, computed, inject, signal, viewChild } from '@angular/core';
import { NgTemplateOutlet, PercentPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { OverlayModule } from '@angular/cdk/overlay';
import { MatBottomSheet, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { CalendarPeriod, SortDirection } from '@shared/core/enum';
import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';
import { CategoryClass, TransactionsSortKey } from '@shared/finance/enum';
import { BudgetStreamUtil } from '@shared/finance/util';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { LayoutService } from './../../core/layout/layout.service';
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
    /** As the section shows it: income, or spending as a positive number; negative when the net runs the other way (CASH-1.9). */
    amount: number;
}

/** The period on screen: a month, quarter or year, by its first day (CASH-1.1). */
export interface SpendingPeriod {
    period: CalendarPeriod;
    start: CalendarDate;
}

/** One choice in the period picker's grid: a month, a quarter or a year. */
interface PeriodOption {
    label: string;
    ariaLabel: string;
    start: CalendarDate;
}

const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// What the stepper's buttons and the picker call each period type.
const periodNouns: Record<CalendarPeriod, string> = {
    [CalendarPeriod.Monthly]: 'month',
    [CalendarPeriod.Quarterly]: 'quarter',
    [CalendarPeriod.Yearly]: 'year'
};

@Component({
    selector: 'app-finance-spending',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        PercentPipe,
        NgTemplateOutlet,
        RouterLink,
        A11yModule,
        OverlayModule,
        MatButtonModule,
        MatButtonToggleModule,
        MatCardModule,
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
    private bottomSheet = inject(MatBottomSheet);
    readonly isCompact = inject(LayoutService).isCompact;

    readonly CalendarPeriod = CalendarPeriod;
    readonly periodTypes = [
        { value: CalendarPeriod.Monthly, label: 'Month' },
        { value: CalendarPeriod.Quarterly, label: 'Quarter' },
        { value: CalendarPeriod.Yearly, label: 'Year' }
    ];
    readonly columns: ListColumn[] = [
        { key: 'name', label: 'Name', compact: 'primary' },
        { key: 'amount', label: 'Amount', width: '9rem', align: 'end', compact: 'trailing' }
    ];

    private readonly today = inject(DateProviderService).today();

    /** Opens on the current month (CASH-1.1). */
    readonly selection = signal<SpendingPeriod>({
        period: CalendarPeriod.Monthly,
        start: CalendarDateUtil.getPeriod(CalendarPeriod.Monthly, this.today).startDate
    });
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
        const current = yearOf(this.today);
        const lookups = this.lookups.value();
        const from = Math.min(lookups?.firstDate ? yearOf(lookups.firstDate) : current, current);
        const to = Math.max(lookups?.lastDate ? yearOf(lookups.lastDate) : current, current);
        return Array.from({ length: to - from + 1 }, (_, i) => from + i);
    });

    // The period's totals: reloads when the period changes, keeping the old ones on screen meanwhile.
    readonly totals = viewResource({
        params: () => this.selection(),
        loader: ({ period, start }) => this.financeService.fetchSpendingTotals(period, start)
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

    // The stepper (CASH-1.1)

    /** The period in full: "May 2026", "Q2 2026" or "2026". */
    readonly periodLabel = computed(() => labelFor(this.selection(), false));
    /** As the stepper shows it, with a short month on phones ("Sep 2026") so the controls fit one row. */
    readonly periodText = computed(() => labelFor(this.selection(), this.isCompact()));
    readonly periodNoun = computed(() => periodNouns[this.selection().period]);
    readonly canStepBack = computed(() => this.canStep(-1));
    readonly canStepForward = computed(() => this.canStep(1));

    /** Moves to the previous or next month, quarter or year, within the years on offer. */
    step(direction: -1 | 1) {
        if (this.canStep(direction)) {
            this.selection.update(({ period, start }) => ({ period, start: this.stepped(period, start, direction) }));
        }
    }

    private canStep(direction: -1 | 1): boolean {
        const { period, start } = this.selection();
        return this.years().includes(yearOf(this.stepped(period, start, direction)));
    }

    private stepped(period: CalendarPeriod, start: CalendarDate, direction: -1 | 1): CalendarDate {
        return CalendarDateUtil.addMonths(start, direction * BudgetStreamUtil.monthsIn(period));
    }

    // The period picker: a popover on wider screens, a bottom sheet on phones (CASH-1.1)

    private readonly pickerSheet = viewChild.required<TemplateRef<unknown>>('pickerSheet');
    private readonly pickerTrigger = viewChild('pickerTrigger', { read: ElementRef });
    private pickerSheetRef?: MatBottomSheetRef;
    readonly isPopoverOpen = signal(false);

    /** The period type and year the picker is showing, before a choice is made. */
    readonly pickerPeriod = signal(CalendarPeriod.Monthly);
    readonly pickerYear = signal(yearOf(this.today));

    readonly pickerOptions = computed<PeriodOption[]>(() => {
        const year = this.pickerYear();
        switch (this.pickerPeriod()) {
            case CalendarPeriod.Monthly:
                return monthNames.map((name, i) => ({
                    label: name.slice(0, 3), ariaLabel: `${name} ${year}`, start: firstDay(year, i)
                }));
            case CalendarPeriod.Quarterly:
                return [1, 2, 3, 4].map(q => ({ label: `Q${q}`, ariaLabel: `Q${q} ${year}`, start: firstDay(year, (q - 1) * 3) }));
            default:
                return this.years().map(y => ({ label: `${y}`, ariaLabel: `${y}`, start: firstDay(y, 0) }));
        }
    });

    readonly canPickPreviousYear = computed(() => this.years().includes(this.pickerYear() - 1));
    readonly canPickNextYear = computed(() => this.years().includes(this.pickerYear() + 1));

    openPicker() {
        const { period, start } = this.selection();
        this.pickerPeriod.set(period);
        this.pickerYear.set(yearOf(start));

        if (this.isCompact()) {
            this.pickerSheetRef = this.bottomSheet.open(this.pickerSheet(), { ariaLabel: 'Choose a period', autoFocus: 'dialog' });
        }
        else {
            this.isPopoverOpen.set(true);
        }
    }

    closePicker() {
        this.pickerSheetRef?.dismiss();
        this.pickerSheetRef = undefined;
        if (this.isPopoverOpen()) {
            this.isPopoverOpen.set(false);
            this.pickerTrigger()?.nativeElement.focus();
        }
    }

    stepPickerYear(direction: -1 | 1) {
        this.pickerYear.update(year => year + direction);
    }

    isSelected(option: PeriodOption): boolean {
        const { period, start } = this.selection();
        return period === this.pickerPeriod() && start === option.start;
    }

    pick(option: PeriodOption) {
        this.selection.set({ period: this.pickerPeriod(), start: option.start });
        this.closePicker();
    }

    // The figures

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

            // Uncategorized counts by sign: the server totals its money in and money out apart (CASH-1.3).
            // Spending is money out, so an expense row counts amounts the other way round.
            const isIncome = group ? group.class === CategoryClass.Income : total.amount > 0;
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

    readonly totalIncome = computed(() => this.rows().income.reduce((sum, row) => sum + row.amount, 0));
    readonly totalExpenses = computed(() => this.rows().expense.reduce((sum, row) => sum + row.amount, 0));
    readonly totalSavings = computed(() => this.totalIncome() - this.totalExpenses());
    readonly savingsRate = computed(() => this.totalIncome() > 0 ? this.totalSavings() / this.totalIncome() : 0);

    // Income is green and expenses the ordinary colour (APP-6.1).
    readonly sections = computed<{ title: string, rows: SpendingRow[], total: number, tone: MoneyTone, empty: string }[]>(() => [
        { title: 'Income', rows: this.rows().income, total: this.totalIncome(), tone: 'favourable', empty: 'No income in this period.' },
        { title: 'Expenses', rows: this.rows().expense, total: this.totalExpenses(), tone: 'plain', empty: 'No expenses in this period.' }
    ]);

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
        const { period, start } = this.selection();
        const { startDate, endDate } = CalendarDateUtil.getPeriod(period, start);
        queryParams['startDate'] = startDate;
        queryParams['endDate'] = endDate;
        return queryParams;
    }
}

function yearOf(date: CalendarDate): number {
    return Number(date.slice(0, 4));
}

/** The first day of a month, by its zero-based index. */
function firstDay(year: number, monthIndex: number): CalendarDate {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}-01`;
}

function labelFor({ period, start }: SpendingPeriod, shortMonth: boolean): string {
    const year = yearOf(start);
    const monthIndex = Number(start.slice(5, 7)) - 1;
    switch (period) {
        case CalendarPeriod.Monthly:
            return `${shortMonth ? monthNames[monthIndex].slice(0, 3) : monthNames[monthIndex]} ${year}`;
        case CalendarPeriod.Quarterly:
            return `Q${Math.floor(monthIndex / 3) + 1} ${year}`;
        default:
            return `${year}`;
    }
}
