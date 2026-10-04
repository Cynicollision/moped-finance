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
import { CategoryType, TransactionsSortKey } from '@shared/finance/enum';
import { BudgetStreamUtil } from '@shared/finance/util';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { LayoutService } from './../../core/layout/layout.service';
import { ListColumn, ListModule } from './../../core/list/list.component';
import { DateProviderService } from './../../core/date-provider.service';
import { CardSkeletonComponent } from './../../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../../core/loading/load-error.component';
import { viewResource } from './../../core/loading/view-resource';
import { MoneyComponent, MoneyTone } from './../common/money.component';
import { ExpenseNecessity, expenseNecessities, expenseNecessityOf } from './../common/necessity';
import { FinanceService } from './../finance.service';

/** How the sections list their rows: by category, by group, or by category under each necessity (CASH-1.5, CASH-1.8). */
export type SpendingViewMode = 'category' | 'group' | 'necessity';

interface SpendingRow {
    /** The category or group ID, depending on the view mode; undefined for uncategorized transactions. */
    id?: string;
    name: string;
    /** As the section shows it: income, or spending as a positive number; negative when the net runs the other way (CASH-1.9). */
    amount: number;
    /** The budget for the period, when the category (or one in the group) has budget streams (CASH-1.10). */
    budget?: number;
    /** By category, an expense row's part of the split; Uncategorized money out is Unclassified (CAT-2.3). */
    necessity?: ExpenseNecessity;
}

/** A part of the expenses split: its total in the summary, and its rows in the Necessity view (CASH-1.8). */
export interface NecessityPart {
    key: ExpenseNecessity;
    title: string;
    rows: SpendingRow[];
    total: number;
    budget?: number;
    /** The part's share of all expenses; 0 when there are none. */
    share: number;
}

/** How a row compares with its budget: "$40 under", "$25 over", or on budget (CASH-1.10). */
export interface BudgetDifference {
    amount: number;
    text: 'under' | 'over' | 'on budget';
    /** Over on an expense, or under on income. */
    isBad: boolean;
}

interface SpendingSection {
    title: string;
    isIncome: boolean;
    rows: SpendingRow[];
    total: number;
    /** The period's budget for the section, when it has any streams (CASH-1.11). */
    budget?: number;
    tone: MoneyTone;
    empty: string;
    /** Expenses in the Necessity view: the rows under Essential, Discretionary and Unclassified (CASH-1.8). */
    parts?: NecessityPart[];
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

// On phones the budget and difference go under the name (CASH-1.10).
const budgetColumns: ListColumn[] = [
    { key: 'budget', label: 'Budget', width: '8rem', align: 'end', compact: 'secondary' },
    { key: 'difference', label: 'Difference', width: '8rem', align: 'end', compact: 'secondary' }
];

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
    /** The budget and difference columns show only when there's a budget to compare with (CASH-1.10). */
    readonly columns = computed<ListColumn[]>(() => [
        { key: 'name', label: this.viewMode() === 'group' ? 'Group' : 'Category', compact: 'primary' },
        ...(this.hasBudget() ? budgetColumns : []),
        { key: 'amount', label: 'Actual', width: '9rem', align: 'end', compact: 'trailing' }
    ]);

    private readonly today = inject(DateProviderService).today();

    /** Opens on the current month (CASH-1.1). */
    readonly selection = signal<SpendingPeriod>({
        period: CalendarPeriod.Monthly,
        start: CalendarDateUtil.getPeriod(CalendarPeriod.Monthly, this.today).startDate
    });
    readonly viewMode = signal<SpendingViewMode>('category');

    readonly lookups = viewResource({
        loader: async () => {
            // The oldest and newest transactions bound the years to choose from (CASH-1.1).
            const edgeTransaction = (sortDirection: SortDirection) => this.financeService.fetchTransactions({
                sortKey: TransactionsSortKey.Date, sortDirection, limit: 1, offset: 0
            });
            const [categories, groups, budgetStreams, [first], [last]] = await Promise.all([
                this.financeService.fetchCategories(false),
                this.financeService.fetchCategoryGroups(),
                this.financeService.fetchBudgetStreams(),
                edgeTransaction(SortDirection.Asc),
                edgeTransaction(SortDirection.Desc)
            ]);
            return { categories, groups, budgetStreams, firstDate: first?.date, lastDate: last?.date };
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

    // The period's totals: reloads when the period changes, keeping the old ones on screen meanwhile. They carry the
    // period they're for, so the budgets beside them match until the new ones arrive.
    readonly totals = viewResource({
        params: () => this.selection(),
        loader: async ({ period, start }) => ({ period, totals: await this.financeService.fetchSpendingTotals(period, start) })
    });

    private readonly categoryMap = computed(() => new Map((this.lookups.value()?.categories ?? []).map(c => [c.id, c])));
    private readonly groupMap = computed(() => new Map((this.lookups.value()?.groups ?? []).map(g => [g.id, g])));
    private readonly categoryTotals = computed(() => this.totals.value()?.totals ?? []);

    /** Each category's budget streams as a monthly amount (BUD-1.6). */
    private readonly monthlyBudgets = computed(() => {
        const budgets = new Map<string, number>();
        for (const stream of this.lookups.value()?.budgetStreams ?? []) {
            budgets.set(stream.categoryId, (budgets.get(stream.categoryId) ?? 0) + BudgetStreamUtil.monthlyAmount(stream));
        }
        return budgets;
    });
    private readonly budgetMonths = computed(() => BudgetStreamUtil.monthsIn(this.totals.value()?.period ?? this.selection().period));

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

    // The rows by category, which the summary's split always needs (CASH-1.8), and the rows the view shows.
    private readonly rows = computed(() => this.buildRows(this.viewMode() === 'group'));

    private buildRows(byGroup: boolean): { income: SpendingRow[]; expense: SpendingRow[] } {
        const income = new Map<string, SpendingRow>();
        const expense = new Map<string, SpendingRow>();

        // The row a category's amounts and budget go in, by category or by group, and whether it's income; none for a
        // Transfer category. Uncategorized goes by the sign it's given.
        const rowFor = (categoryId: string, isUncategorizedIncome: boolean) => {
            const cat = categoryId ? this.categoryMap().get(categoryId) : undefined;
            const group = cat ? this.groupMap().get(cat.groupId) : undefined;
            if (group?.type === CategoryType.Transfer) {
                return undefined;
            }

            const id = byGroup ? group?.id : cat?.id;
            const name = byGroup
                ? (group?.name || 'Uncategorized')
                : (cat ? `${cat.icon} ${cat.name}` : 'Uncategorized');
            const isIncome = group ? group.type === CategoryType.Income : isUncategorizedIncome;
            const rows = isIncome ? income : expense;
            const necessity = isIncome || byGroup ? undefined : expenseNecessityOf(cat);
            const row = rows.get(id ?? '') ?? { id, name, amount: 0, necessity };
            rows.set(id ?? '', row);
            return { row, isIncome };
        };

        for (const total of this.categoryTotals()) {
            // Uncategorized counts by sign: the server totals its money in and money out apart (CASH-1.3).
            const target = rowFor(total.categoryId, total.amount > 0);
            // Spending is money out, so an expense row counts amounts the other way round.
            if (target) {
                target.row.amount += target.isIncome ? total.amount : -total.amount;
            }
        }

        // A budgeted category shows even with nothing spent, so the rows add up to the budget (CASH-1.10).
        for (const [categoryId, monthly] of this.monthlyBudgets()) {
            const target = rowFor(categoryId, false);
            if (target) {
                target.row.budget = (target.row.budget ?? 0) + monthly * this.budgetMonths();
            }
        }

        const largestFirst = (a: SpendingRow, b: SpendingRow) => (b.amount - a.amount) || ((b.budget ?? 0) - (a.budget ?? 0));
        return {
            income: [...income.values()].sort(largestFirst),
            expense: [...expense.values()].sort(largestFirst)
        };
    }

    readonly hasBudget = computed(() => [...this.rows().income, ...this.rows().expense].some(row => row.budget !== undefined));

    readonly totalIncome = computed(() => sumOf(this.rows().income, row => row.amount));
    readonly totalExpenses = computed(() => sumOf(this.rows().expense, row => row.amount));
    readonly totalSavings = computed(() => this.totalIncome() - this.totalExpenses());
    readonly savingsRate = computed(() => this.totalIncome() > 0 ? this.totalSavings() / this.totalIncome() : 0);

    private readonly budgetedIncome = computed(() => budgetOf(this.rows().income));
    private readonly budgetedExpenses = computed(() => budgetOf(this.rows().expense));
    /** Budgeted income less budgeted expenses, when either has streams (CASH-1.11). */
    readonly budgetedSavings = computed(() => this.hasBudget() ? (this.budgetedIncome() ?? 0) - (this.budgetedExpenses() ?? 0) : undefined);

    // Income is green and expenses the ordinary colour (APP-6.1).
    readonly sections = computed<SpendingSection[]>(() => [
        {
            title: 'Income', isIncome: true, rows: this.rows().income, total: this.totalIncome(), budget: this.budgetedIncome(),
            tone: 'favourable', empty: 'No income in this period.'
        },
        {
            title: 'Expenses', isIncome: false, rows: this.rows().expense, total: this.totalExpenses(), budget: this.budgetedExpenses(),
            tone: 'plain', empty: 'No expenses in this period.',
            parts: this.viewMode() === 'necessity' ? this.splitByNecessity().filter(part => part.rows.length > 0) : undefined
        }
    ]);

    /** Expenses by category under Essential, Discretionary and Unclassified, for the Necessity view (CASH-1.8). */
    private splitByNecessity(): NecessityPart[] {
        const expenses = this.rows().expense;
        return expenseNecessities.map(({ key, label }) => {
            const rows = expenses.filter(row => row.necessity === key);
            const total = sumOf(rows, row => row.amount);
            const share = this.totalExpenses() > 0 ? total / this.totalExpenses() : 0;
            return { key, title: label, rows, total, budget: budgetOf(rows), share };
        });
    }

    /** How a row compares with its budget, in whole dollars; over on an expense, or under on income, is bad (CASH-1.10). */
    difference(row: SpendingRow, section: SpendingSection): BudgetDifference | undefined {
        if (row.budget === undefined) {
            return undefined;
        }
        const over = Math.round(row.amount - row.budget);
        if (over === 0) {
            return { amount: 0, text: 'on budget', isBad: false };
        }
        return { amount: Math.abs(over), text: over > 0 ? 'over' : 'under', isBad: section.isIncome ? over < 0 : over > 0 };
    }

    /** The Transactions filters for a row: its category or group, and the period (CASH-1.6). */
    rowQueryParams(row: SpendingRow): Record<string, string> {
        const queryParams: Record<string, string> = {};

        if (this.viewMode() !== 'group' && row.id) {
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

function sumOf(rows: SpendingRow[], value: (row: SpendingRow) => number): number {
    return rows.reduce((sum, row) => sum + value(row), 0);
}

/** A section's budget: its rows' budgets added up, or undefined when none has one. */
function budgetOf(rows: SpendingRow[]): number | undefined {
    const budgeted = rows.filter(row => row.budget !== undefined);
    return budgeted.length > 0 ? sumOf(budgeted, row => row.budget ?? 0) : undefined;
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
