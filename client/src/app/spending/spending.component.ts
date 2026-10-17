import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    TemplateRef,
    computed,
    inject,
    signal,
    viewChild
} from '@angular/core';
import { NgTemplateOutlet, PercentPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { A11yModule } from '@angular/cdk/a11y';
import { OverlayModule } from '@angular/cdk/overlay';
import { MatBottomSheet, MatBottomSheetRef } from '@angular/material/bottom-sheet';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { CalendarPeriod, SortDirection } from '@shared/core/enum';
import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';
import { BudgetStreamType, CategoryType, TransactionsSortKey } from '@shared/finance/enum';
import { BudgetStreamUtil, Uncategorized } from '@shared/finance/util';
import { PageHeaderComponent } from './../core/layout/page-header.component';
import { LayoutService } from './../core/layout/layout.service';
import { ListColumn, ListModule } from './../core/list/list.component';
import { DateProviderService } from './../core/date-provider.service';
import { CardSkeletonComponent } from './../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { viewResource } from './../core/loading/view-resource';
import { categoryLabel } from './../common/category-label';
import { MoneyComponent, MoneyTone } from './../common/money.component';
import { ExpenseNecessity, expenseNecessities, expenseNecessityOf } from './../common/necessity';
import { FinanceService } from './../common/finance.service';

/** How the sections list their rows: by category (expenses under each necessity, CASH-1.8), or by group (CASH-1.5). */
export type SpendingViewMode = 'category' | 'group';

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

/** A calendar period (CASH-1.1), or the average month over the past 12 (CASH-1.12). */
export type SpendingPeriodType = CalendarPeriod | 'average';

/** The period on screen: a month, quarter or year by its first day, or the average month (CASH-1.1, CASH-1.12). */
export interface SpendingPeriod {
    period: SpendingPeriodType;
    /** The first day of the period; for the average month, of the current month. */
    start: CalendarDate;
}

/** The dates the totals on screen are for, and how many months they span. */
interface SpendingWindow {
    startDate: CalendarDate;
    endDate: CalendarDate;
    months: number;
}

/** One choice in the period picker's grid: a month, a quarter or a year. */
interface PeriodOption {
    label: string;
    ariaLabel: string;
    start: CalendarDate;
}

const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December'
];

// On phones the budget and difference go under the name (CASH-1.10).
const budgetColumns: ListColumn[] = [
    { key: 'budget', label: 'Budget', width: '8rem', align: 'end', compact: 'secondary' },
    { key: 'difference', label: 'Difference', width: '8rem', align: 'end', compact: 'secondary' }
];

// What the stepper's buttons and the picker call each period type.
const periodNouns: Record<SpendingPeriodType, string> = {
    [CalendarPeriod.Monthly]: 'month',
    [CalendarPeriod.Quarterly]: 'quarter',
    [CalendarPeriod.Yearly]: 'year',
    average: 'period'
};

@Component({
    selector: 'app-spending',
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
        MatFormFieldModule,
        MatIconModule,
        MatSelectModule,
        PageHeaderComponent,
        CardSkeletonComponent,
        LoadErrorComponent,
        ListModule,
        MoneyComponent
    ],
    templateUrl: './spending.component.html',
    styleUrl: './spending.component.scss'
})
export class SpendingComponent {
    private financeService = inject(FinanceService);
    private bottomSheet = inject(MatBottomSheet);
    readonly isCompact = inject(LayoutService).isCompact;

    readonly CalendarPeriod = CalendarPeriod;
    readonly periodTypes: { value: SpendingPeriodType; label: string }[] = [
        { value: CalendarPeriod.Monthly, label: 'Month' },
        { value: CalendarPeriod.Quarterly, label: 'Quarter' },
        { value: CalendarPeriod.Yearly, label: 'Year' },
        { value: 'average', label: 'Average' }
    ];
    /** The budget and difference columns show only when there's a budget to compare with (CASH-1.10). */
    readonly columns = computed<ListColumn[]>(() => [
        { key: 'name', label: this.viewMode() === 'group' ? 'Group' : 'Category', compact: 'primary' },
        ...(this.hasBudget() ? budgetColumns : []),
        { key: 'amount', label: 'Actual', width: '9rem', align: 'end', compact: 'trailing' }
    ]);

    private readonly today = inject(DateProviderService).today();
    private readonly currentMonth = CalendarDateUtil.getPeriod(CalendarPeriod.Monthly, this.today).startDate;

    /** Opens on the current month (CASH-1.1), or on the average month when the URL asks for it (CASH-1.12). */
    readonly selection = signal<SpendingPeriod>({
        period:
            inject(ActivatedRoute).snapshot.queryParamMap.get('period') === 'average'
                ? 'average'
                : CalendarPeriod.Monthly,
        start: this.currentMonth
    });
    readonly viewMode = signal<SpendingViewMode>('category');

    readonly lookups = viewResource({
        loader: async () => {
            // The oldest and newest transactions bound the years to choose from (CASH-1.1).
            const edgeTransaction = (sortDirection: SortDirection) =>
                this.financeService.fetchTransactions({
                    sortKey: TransactionsSortKey.Date,
                    sortDirection,
                    limit: 1,
                    offset: 0
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
    // period and dates they're for, so the budgets and drill-downs beside them match until the new ones arrive.
    readonly totals = viewResource({
        params: () => this.selection(),
        loader: async ({ period, start }) => {
            if (period === 'average') {
                const { totals, ...window } = await this.financeService.fetchSpendingAverage(this.today);
                return { period, totals, window };
            }
            const { startDate, endDate } = CalendarDateUtil.getPeriod(period, start);
            const window = { startDate, endDate, months: BudgetStreamUtil.monthsIn(period) };
            return { period, totals: await this.financeService.fetchSpendingTotals(period, start), window };
        }
    });

    private readonly categoryMap = computed(
        () => new Map((this.lookups.value()?.categories ?? []).map(c => [c.id, c]))
    );
    private readonly groupMap = computed(() => new Map((this.lookups.value()?.groups ?? []).map(g => [g.id, g])));
    private readonly categoryTotals = computed(() => this.totals.value()?.totals ?? []);

    // The average month is compared with the monthly budget (CASH-1.12).
    private readonly budgetMonths = computed(() => {
        const period = this.totals.value()?.period ?? this.selection().period;
        return period === 'average' ? 1 : BudgetStreamUtil.monthsIn(period);
    });

    readonly error = computed(() => this.lookups.error() ?? this.totals.error());
    readonly isLoaded = computed(() => this.lookups.value() !== undefined && this.totals.value() !== undefined);

    retry() {
        this.lookups.reload();
        this.totals.reload();
    }

    // The period type and the stepper (CASH-1.1)

    /**
     * Shows the period of the chosen type that holds today, if the one on screen does, or else the one holding its
     * first day: May 2026 becomes Q2 2026, and 2025 becomes January 2025.
     */
    choosePeriodType(type: SpendingPeriodType) {
        const { period, start } = this.selection();
        if (type === period) {
            return;
        }
        if (type === 'average') {
            this.selection.set({ period: type, start: this.currentMonth });
            return;
        }
        const anchor = period === 'average' || this.holdsToday(period, start) ? this.today : start;
        this.selection.set({ period: type, start: CalendarDateUtil.getPeriod(type, anchor).startDate });
    }

    private holdsToday(period: CalendarPeriod, start: CalendarDate): boolean {
        const { startDate, endDate } = CalendarDateUtil.getPeriod(period, start);
        return startDate <= this.today && this.today <= endDate;
    }

    /** The period in full: "May 2026", "Q2 2026", "2026" or "Average month, May 2025 to Apr 2026". */
    readonly periodLabel = computed(() => this.labelFor(false));
    /** As the stepper shows it, with a short month on phones ("Sep 2026", "Avg, ...") so the period controls fit one row. */
    readonly periodText = computed(() => this.labelFor(this.isCompact()));
    readonly periodNoun = computed(() => periodNouns[this.selection().period]);
    readonly canStepBack = computed(() => this.canStep(-1));
    readonly canStepForward = computed(() => this.canStep(1));

    /** Moves to the previous or next month, quarter or year, within the years on offer. */
    step(direction: -1 | 1) {
        if (this.canStep(direction)) {
            this.selection.update(({ period, start }) => ({ period, start: this.stepped(period, start, direction) }));
        }
    }

    // The average month doesn't step (CASH-1.12).
    private canStep(direction: -1 | 1): boolean {
        const { period, start } = this.selection();
        return period !== 'average' && this.years().includes(yearOf(this.stepped(period, start, direction)));
    }

    private stepped(period: SpendingPeriodType, start: CalendarDate, direction: -1 | 1): CalendarDate {
        return period === 'average'
            ? start
            : CalendarDateUtil.addMonths(start, direction * BudgetStreamUtil.monthsIn(period));
    }

    private labelFor(shortMonth: boolean): string {
        const selection = this.selection();
        if (selection.period !== 'average') {
            return labelFor(selection.period, selection.start, shortMonth);
        }

        // The window is known once it has loaded: "Average month, May 2025 to Apr 2026" (CASH-1.12).
        const prefix = shortMonth ? 'Avg' : 'Average month';
        const loaded = this.totals.value();
        if (loaded?.period !== 'average' || loaded.window.months === 0) {
            return prefix;
        }
        const from = labelFor(CalendarPeriod.Monthly, loaded.window.startDate, true);
        const to = labelFor(CalendarPeriod.Monthly, loaded.window.endDate, true);
        return `${prefix}, ${from === to ? to : `${from} to ${to}`}`;
    }

    // The period picker: a popover on wider screens, a bottom sheet on phones (CASH-1.1)

    private readonly pickerSheet = viewChild.required<TemplateRef<unknown>>('pickerSheet');
    private readonly pickerTrigger = viewChild('pickerTrigger', { read: ElementRef });
    private pickerSheetRef?: MatBottomSheetRef;
    readonly isPopoverOpen = signal(false);

    /** Months and quarters are chosen within a year, which the picker steps through before a choice is made. */
    readonly showsPickerYear = computed(
        () => this.selection().period === CalendarPeriod.Monthly || this.selection().period === CalendarPeriod.Quarterly
    );
    readonly pickerYear = signal(yearOf(this.today));

    readonly pickerOptions = computed<PeriodOption[]>(() => {
        const year = this.pickerYear();
        switch (this.selection().period) {
            case CalendarPeriod.Monthly:
                return monthNames.map((name, i) => ({
                    label: name.slice(0, 3),
                    ariaLabel: `${name} ${year}`,
                    start: firstDay(year, i)
                }));
            case CalendarPeriod.Quarterly:
                return [1, 2, 3, 4].map(q => ({
                    label: `Q${q}`,
                    ariaLabel: `Q${q} ${year}`,
                    start: firstDay(year, (q - 1) * 3)
                }));
            case CalendarPeriod.Yearly:
                return this.years().map(y => ({ label: `${y}`, ariaLabel: `${y}`, start: firstDay(y, 0) }));
            default:
                return [];
        }
    });

    readonly canPickPreviousYear = computed(() => this.years().includes(this.pickerYear() - 1));
    readonly canPickNextYear = computed(() => this.years().includes(this.pickerYear() + 1));

    openPicker() {
        this.pickerYear.set(yearOf(this.selection().start));

        if (this.isCompact()) {
            this.pickerSheetRef = this.bottomSheet.open(this.pickerSheet(), {
                ariaLabel: `Choose a ${this.periodNoun()}`,
                autoFocus: 'dialog'
            });
        } else {
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
        return this.selection().start === option.start;
    }

    pick(option: PeriodOption) {
        this.selection.update(({ period }) => ({ period, start: option.start }));
        this.closePicker();
    }

    // The figures

    // The rows by category, which the summary's split always needs (CASH-1.8), and the rows the view shows.
    private readonly rows = computed(() => this.buildRows(this.viewMode() === 'group'));

    private buildRows(byGroup: boolean): { income: SpendingRow[]; expense: SpendingRow[] } {
        const income = new Map<string, SpendingRow>();
        const expense = new Map<string, SpendingRow>();

        // The row a category's amounts and budget go in, by category or by group, in the section the server or the
        // stream puts it in. Uncategorized amounts come in both sections.
        const rowFor = (categoryId: string, isIncome: boolean) => {
            const cat = categoryId ? this.categoryMap().get(categoryId) : undefined;
            const group = cat ? this.groupMap().get(cat.groupId) : undefined;
            const id = byGroup ? group?.id : cat?.id;
            const name = byGroup ? group?.name || 'Uncategorized' : cat ? categoryLabel(cat) : 'Uncategorized';
            const rows = isIncome ? income : expense;
            const necessity = isIncome || byGroup ? undefined : expenseNecessityOf(cat);
            const row = rows.get(id ?? '') ?? { id, name, amount: 0, necessity };
            rows.set(id ?? '', row);
            return row;
        };

        // The server decides income or expense and leaves out transfers (CASH-1.3).
        for (const total of this.categoryTotals()) {
            rowFor(total.categoryId, total.type === CategoryType.Income).amount += total.amount;
        }

        // A budgeted category shows even with nothing spent, so the rows add up to the budget (CASH-1.10). Savings
        // streams aren't compared here (CASH Notes).
        for (const stream of this.lookups.value()?.budgetStreams ?? []) {
            if (stream.type !== BudgetStreamType.Savings) {
                const row = rowFor(stream.categoryId, stream.type === BudgetStreamType.Income);
                row.budget = (row.budget ?? 0) + BudgetStreamUtil.monthlyAmount(stream) * this.budgetMonths();
            }
        }

        const largestFirst = (a: SpendingRow, b: SpendingRow) =>
            b.amount - a.amount || (b.budget ?? 0) - (a.budget ?? 0);
        return {
            income: [...income.values()].sort(largestFirst),
            expense: [...expense.values()].sort(largestFirst)
        };
    }

    readonly hasBudget = computed(() =>
        [...this.rows().income, ...this.rows().expense].some(row => row.budget !== undefined)
    );

    readonly totalIncome = computed(() => sumOf(this.rows().income, row => row.amount));
    readonly totalExpenses = computed(() => sumOf(this.rows().expense, row => row.amount));
    readonly totalSavings = computed(() => this.totalIncome() - this.totalExpenses());
    readonly savingsRate = computed(() => (this.totalIncome() > 0 ? this.totalSavings() / this.totalIncome() : 0));

    private readonly budgetedIncome = computed(() => budgetOf(this.rows().income));
    private readonly budgetedExpenses = computed(() => budgetOf(this.rows().expense));
    /** Budgeted income less budgeted expenses, when either has streams (CASH-1.11). */
    readonly budgetedSavings = computed(() =>
        this.hasBudget() ? (this.budgetedIncome() ?? 0) - (this.budgetedExpenses() ?? 0) : undefined
    );

    // Income is green and expenses the ordinary colour (APP-6.1).
    readonly sections = computed<SpendingSection[]>(() => [
        {
            title: 'Income',
            isIncome: true,
            rows: this.rows().income,
            total: this.totalIncome(),
            budget: this.budgetedIncome(),
            tone: 'favourable',
            empty: 'No income in this period.'
        },
        {
            title: 'Expenses',
            isIncome: false,
            rows: this.rows().expense,
            total: this.totalExpenses(),
            budget: this.budgetedExpenses(),
            tone: 'plain',
            empty: 'No expenses in this period.',
            parts:
                this.viewMode() === 'category' && this.hasNecessities()
                    ? this.splitByNecessity().filter(part => part.rows.length > 0)
                    : undefined
        }
    ]);

    /** Whether any category has a necessity; until one does, the Category view lists expenses without headings (CASH-1.8). */
    private readonly hasNecessities = computed(() => (this.lookups.value()?.categories ?? []).some(c => c.necessity));

    /** Expenses by category under Essential, Discretionary and Unclassified, for the Category view (CASH-1.8). */
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
        return {
            amount: Math.abs(over),
            text: over > 0 ? 'over' : 'under',
            isBad: section.isIncome ? over < 0 : over > 0
        };
    }

    /** The Transactions filters for a row: its category or group, and the period (CASH-1.6). */
    rowQueryParams(row: SpendingRow): Record<string, string> {
        const queryParams: Record<string, string> = {};

        // An uncategorized row opens the Uncategorized filter, in either view (TXN-1.11).
        if (!row.id) {
            queryParams['categoryId'] = Uncategorized.filterValue;
        } else if (this.viewMode() === 'group') {
            queryParams['group'] = row.id;
        } else {
            queryParams['categoryId'] = row.id;
        }

        // The same dates the server totalled: the period, or the average month's whole window (CASH-1.6, CASH-1.12).
        const window: SpendingWindow | undefined = this.totals.value()?.window;
        if (window) {
            queryParams['startDate'] = window.startDate;
            queryParams['endDate'] = window.endDate;
        }
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

function labelFor(period: CalendarPeriod, start: CalendarDate, shortMonth: boolean): string {
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
