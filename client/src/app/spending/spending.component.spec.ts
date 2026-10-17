import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { CalendarPeriod, SortDirection } from '@shared/core/enum';
import { SpendingAverage, SpendingTotal, TransactionSearchOptions } from '@shared/finance/contracts';
import { CategoryNecessity, CategoryType } from '@shared/finance/enum';
import { BudgetStream, Category, CategoryGroup } from '@shared/finance/types';
import { BudgetStreamUtil } from '@shared/finance/util';
import { DateProviderService } from './../core/date-provider.service';
import { LayoutService } from './../core/layout/layout.service';
import { FinanceService } from './../common/finance.service';
import { SpendingComponent } from './spending.component';

describe('SpendingComponent', () => {
    const created = { createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 1) };
    const groups: CategoryGroup[] = [
        { id: 'income', name: 'Income', type: CategoryType.Income, ...created },
        { id: 'housing', name: 'Housing', type: CategoryType.Expense, ...created },
        { id: 'food', name: 'Food', type: CategoryType.Expense, ...created },
        { id: 'transfers', name: 'Transfers', type: CategoryType.Transfer, ...created }
    ];
    const categories: Category[] = [
        { id: 'pay', groupId: 'income', name: 'Paycheck', icon: '💼', isActive: true, necessity: null, ...created },
        {
            id: 'rent',
            groupId: 'housing',
            name: 'Rent',
            icon: '🏠',
            isActive: true,
            necessity: CategoryNecessity.Essential,
            ...created
        },
        {
            id: 'utilities',
            groupId: 'housing',
            name: 'Utilities',
            icon: '💡',
            isActive: true,
            necessity: CategoryNecessity.Essential,
            ...created
        },
        {
            id: 'groceries',
            groupId: 'food',
            name: 'Groceries',
            icon: '🛒',
            isActive: true,
            necessity: CategoryNecessity.Essential,
            ...created
        },
        {
            id: 'dining',
            groupId: 'food',
            name: 'Dining',
            icon: '🍽️',
            isActive: true,
            necessity: CategoryNecessity.Discretionary,
            ...created
        },
        {
            id: 'card',
            groupId: 'transfers',
            name: 'Card Payment',
            icon: '💳',
            isActive: true,
            necessity: null,
            ...created
        }
    ];
    // The period's totals as the server classifies them (CASH-1.3): transfers are left out.
    const income = (categoryId: string, amount: number): SpendingTotal => ({
        categoryId,
        type: CategoryType.Income,
        amount
    });
    const expense = (categoryId: string, amount: number): SpendingTotal => ({
        categoryId,
        type: CategoryType.Expense,
        amount
    });
    const totals: SpendingTotal[] = [
        income('pay', 4000),
        expense('rent', 1500),
        expense('utilities', 200),
        expense('groceries', 300)
    ];

    // The average month over May 2025 to April 2026, as the server works it out (CASH-1.12).
    const average: SpendingAverage = {
        startDate: '2025-05-01',
        endDate: '2026-04-30',
        months: 12,
        totals: [income('pay', 4100), expense('rent', 1500), expense('groceries', 425)],
        transfers: []
    };

    // A stream's type follows from its category's (BUD-1.1).
    function stream(categoryId: string, amount: number, recurrence = CalendarPeriod.Monthly): BudgetStream {
        const groupId = categories.find(c => c.id === categoryId)!.groupId;
        return {
            id: `${categoryId}-${amount}`,
            type: BudgetStreamUtil.typeOf(groups.find(g => g.id === groupId)!.type),
            name: categoryId,
            categoryId,
            amount,
            recurrence,
            ...created
        };
    }

    // Per month: $4,200 of pay, $2,150 of expenses (groceries quarterly), and $500 moved to savings.
    const budget: BudgetStream[] = [
        stream('pay', 4200),
        stream('rent', 1500),
        stream('groceries', 1200, CalendarPeriod.Quarterly),
        stream('utilities', 150),
        stream('dining', 100),
        stream('card', 500)
    ];

    // Renders Spending once its categories, budget and the period's totals have loaded, with today 2026-05-17. The
    // transactions are the oldest and newest, which bound the years offered.
    async function render(
        periodTotals = totals,
        oldest?: string,
        newest?: string,
        budgetStreams: BudgetStream[] = [],
        withCategories = categories,
        url = '/'
    ) {
        const edge = (date?: string) => (date ? [{ id: date, date }] : []);
        const isCompact = signal(false);
        const financeService = {
            fetchCategories: vi.fn().mockResolvedValue(withCategories),
            fetchCategoryGroups: vi.fn().mockResolvedValue(groups),
            fetchBudgetStreams: vi.fn().mockResolvedValue(budgetStreams),
            fetchSpendingTotals: vi.fn().mockResolvedValue(periodTotals),
            fetchSpendingAverage: vi.fn().mockResolvedValue(average),
            fetchTransactions: vi.fn((search: TransactionSearchOptions) =>
                Promise.resolve(search.sortDirection === SortDirection.Asc ? edge(oldest) : edge(newest))
            )
        };
        TestBed.configureTestingModule({
            imports: [SpendingComponent],
            providers: [
                provideRouter([]),
                {
                    provide: DateProviderService,
                    useValue: { now: () => new Date(2026, 4, 17), today: () => '2026-05-17' }
                },
                { provide: LayoutService, useValue: { isCompact } },
                { provide: FinanceService, useValue: financeService }
            ]
        });

        await TestBed.inject(Router).navigateByUrl(url);
        const fixture = TestBed.createComponent(SpendingComponent);
        await fixture.whenStable();
        return Object.assign(fixture, { financeService, isCompact, element: fixture.nativeElement as HTMLElement });
    }

    /** The element's text, without the row's leading icons (CASH-1.1). */
    function text(element: Element | null): string {
        const copy = element!.cloneNode(true) as Element;
        copy.querySelectorAll('.control-icon').forEach(icon => icon.remove());
        return copy.textContent!.replace(/\s+/g, ' ').trim();
    }

    function budgeted(element: HTMLElement): string[] {
        return Array.from(element.querySelectorAll('.summary-card .budgeted')).map(text);
    }

    /** Saved, the savings rate, then Income and Expenses, as the summary card shows them. */
    function summary(element: HTMLElement): string[] {
        return [
            text(element.querySelector('.saved .headline')),
            text(element.querySelector('.saved .rate')),
            ...Array.from(element.querySelectorAll('.summary-figures .value')).map(text)
        ];
    }

    function section(element: HTMLElement, title: string): Element {
        return Array.from(element.querySelectorAll('.section-card')).find(
            card => text(card.querySelector('h2')) === title
        )!;
    }

    function sectionRows(element: HTMLElement, title: string): string[] {
        return Array.from(section(element, title).querySelectorAll('a.app-list-row')).map(row =>
            Array.from(row.querySelectorAll('.app-list-cell')).map(text).join(' ')
        );
    }

    function button(element: HTMLElement, label: string): HTMLButtonElement {
        return element.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    }

    /** Opens a dropdown in the row (`.period-type`) and returns its options. */
    async function dropdownOptions(
        fixture: Awaited<ReturnType<typeof render>>,
        dropdown: string
    ): Promise<HTMLElement[]> {
        fixture.element.querySelector<HTMLElement>(`${dropdown} .mat-mdc-select-trigger`)!.click();
        await fixture.whenStable();
        return Array.from(document.querySelectorAll<HTMLElement>('mat-option'));
    }

    async function choose(fixture: Awaited<ReturnType<typeof render>>, dropdown: string, label: string) {
        (await dropdownOptions(fixture, dropdown)).find(option => text(option) === label)!.click();
        await fixture.whenStable();
    }

    /** Chooses a period type from the dropdown (CASH-1.1). */
    function choosePeriodType(fixture: Awaited<ReturnType<typeof render>>, label: string) {
        return choose(fixture, '.period-type', label);
    }

    it('CASH-1.4 should total income and expenses', async () => {
        const { element } = await render();

        expect(summary(element)).toEqual(['$2,000', '50% of income', '$4,000', '$2,000']);
    });

    it('CASH-1.4 should show negative savings signed and red, and expenses never red', async () => {
        const { element } = await render([income('pay', 1000), expense('rent', 1500)]);

        expect(summary(element)).toEqual(['-$500', '-50% of income', '$1,000', '$1,500']);
        const colours = Array.from(element.querySelectorAll('.summary-card :is(.headline, .value) span')).map(
            span => span.className
        );
        expect(colours).toEqual(['money-negative', 'money-positive', '']);
    });

    it('CASH-1.4 should show a savings rate of 0% when there is no income', async () => {
        const { element } = await render([expense('rent', 1500)]);

        expect(summary(element)[1]).toBe('0% of income');
    });

    it('CASH-1.5 should head each section with its total', async () => {
        const { element } = await render();

        expect(text(section(element, 'Income').querySelector('.section-total'))).toBe('$4,000');
        expect(text(section(element, 'Expenses').querySelector('.section-total'))).toBe('$2,000');
    });

    it('CASH-1.3 should count uncategorized money in as income and money out as expenses', async () => {
        const { element } = await render([...totals, income('', 50), expense('', 80)]);

        expect(sectionRows(element, 'Income')).toEqual(['💼 Paycheck $4,000.00', 'Uncategorized $50.00']);
        expect(sectionRows(element, 'Expenses')).toEqual([
            '🏠 Rent $1,500.00',
            '🛒 Groceries $300.00',
            '💡 Utilities $200.00',
            'Uncategorized $80.00'
        ]);
    });

    it('CASH-1.9 should show an expense category that is net money in as a negative expense', async () => {
        const { element } = await render([
            ...totals.filter(t => t.categoryId !== 'groceries'),
            expense('groceries', -20)
        ]);

        expect(sectionRows(element, 'Expenses')).toEqual([
            '🏠 Rent $1,500.00',
            '💡 Utilities $200.00',
            '🛒 Groceries -$20.00'
        ]);
        expect(summary(element)[3]).toBe('$1,680');
    });

    it('CASH-1.5 should list amounts by category, largest first', async () => {
        const { element } = await render();

        expect(sectionRows(element, 'Income')).toEqual(['💼 Paycheck $4,000.00']);
        expect(sectionRows(element, 'Expenses')).toEqual([
            '🏠 Rent $1,500.00',
            '🛒 Groceries $300.00',
            '💡 Utilities $200.00'
        ]);
    });

    it('CASH-1.5 should switch both sections to category groups from the page menu', async () => {
        const fixture = await render();
        const { element } = fixture;

        button(element, 'More options').click();
        await fixture.whenStable();
        const items = Array.from(document.querySelectorAll<HTMLElement>('.mat-mdc-menu-item'));
        expect(items.map(item => text(item.querySelector('span')))).toEqual(['By category', 'By group']);
        expect(text(items[0].querySelector('mat-icon'))).toBe('check');
        items[1].click();
        await fixture.whenStable();

        expect(sectionRows(element, 'Income')).toEqual(['Income $4,000.00']);
        expect(sectionRows(element, 'Expenses')).toEqual(['Housing $1,700.00', 'Food $300.00']);
        document.querySelectorAll('.cdk-overlay-container').forEach(container => container.remove());
    });

    it('CASH-1.7 should say when a section has nothing for the period', async () => {
        const { element } = await render([]);

        expect(text(section(element, 'Income').querySelector('.empty'))).toBe('No income in this period.');
        expect(text(section(element, 'Expenses').querySelector('.empty'))).toBe('No expenses in this period.');
    });

    it('CASH-1.1 should offer every year from the oldest transaction to the newest, and the current year', async () => {
        const { componentInstance } = await render(totals, '2023-02-10', '2026-04-30');

        expect(componentInstance.years()).toEqual([2023, 2024, 2025, 2026]);
    });

    it('CASH-1.1 should offer only the current year when there are no transactions', async () => {
        const { componentInstance } = await render();

        expect(componentInstance.years()).toEqual([2026]);
    });

    /** Opens the period picker and chooses the option with this accessible name ("March 2026", "Q1 2026", "2025"). */
    async function pickPeriod(fixture: Awaited<ReturnType<typeof render>>, label: string) {
        fixture.componentInstance.openPicker();
        await fixture.whenStable();
        document.querySelector<HTMLButtonElement>(`.picker-option[aria-label="${label}"]`)!.click();
        await fixture.whenStable();
    }

    it('CASH-1.1 should open on the current month, and choose another from the picker', async () => {
        const fixture = await render(totals, '2025-06-01');
        const { element, financeService } = fixture;

        expect(text(element.querySelector('.period-button'))).toBe('May 2026 arrow_drop_down');
        await pickPeriod(fixture, 'March 2026');

        expect(document.querySelector('.period-popover')).toBeNull();
        expect(text(element.querySelector('.period-button'))).toBe('March 2026 arrow_drop_down');
        expect(financeService.fetchSpendingTotals.mock.calls).toEqual([
            [CalendarPeriod.Monthly, '2026-05-01'],
            [CalendarPeriod.Monthly, '2026-03-01']
        ]);
    });

    it("CASH-1.1 should step the picker's year only within the years on offer", async () => {
        const fixture = await render(totals, '2025-06-01');
        const { componentInstance: spending, element } = fixture;

        spending.openPicker();
        await fixture.whenStable();
        expect(button(document.body, 'Next year').disabled).toBe(true);
        button(document.body, 'Previous year').click();
        await fixture.whenStable();
        expect(text(document.querySelector('.picker-year-label'))).toBe('2025');
        expect(button(document.body, 'Previous year').disabled).toBe(true);
        document.querySelector<HTMLButtonElement>('.picker-option[aria-label="December 2025"]')!.click();
        await fixture.whenStable();

        expect(text(element.querySelector('.period-button'))).toBe('December 2025 arrow_drop_down');
    });

    it('CASH-1.1 should offer each kind of period in a dropdown', async () => {
        const fixture = await render();

        expect(text(fixture.element.querySelector('.period-type'))).toBe('Month');
        expect((await dropdownOptions(fixture, '.period-type')).map(text)).toEqual([
            'Month',
            'Quarter',
            'Year',
            'Average'
        ]);
    });

    it("CASH-1.1 should change the kind of period to the one holding today, or the one on screen's first day", async () => {
        const fixture = await render(totals, '2025-06-01');
        const { element, financeService } = fixture;

        await choosePeriodType(fixture, 'Quarter');
        expect(text(element.querySelector('.period-button'))).toBe('Q2 2026 arrow_drop_down');
        await choosePeriodType(fixture, 'Year');
        await pickPeriod(fixture, '2025');
        expect(text(element.querySelector('.period-button'))).toBe('2025 arrow_drop_down');
        await choosePeriodType(fixture, 'Month');
        expect(text(element.querySelector('.period-button'))).toBe('January 2025 arrow_drop_down');
        await choosePeriodType(fixture, 'Average');
        await choosePeriodType(fixture, 'Month');

        expect(financeService.fetchSpendingTotals.mock.calls).toEqual([
            [CalendarPeriod.Monthly, '2026-05-01'],
            [CalendarPeriod.Quarterly, '2026-04-01'],
            [CalendarPeriod.Yearly, '2026-01-01'],
            [CalendarPeriod.Yearly, '2025-01-01'],
            [CalendarPeriod.Monthly, '2025-01-01'],
            [CalendarPeriod.Monthly, '2026-05-01']
        ]);
    });

    it('CASH-1.1 should choose a quarter from the picker', async () => {
        const fixture = await render();
        const { componentInstance: spending, element, financeService } = fixture;

        await choosePeriodType(fixture, 'Quarter');
        spending.openPicker();
        await fixture.whenStable();
        const options = Array.from(document.querySelectorAll<HTMLButtonElement>('.picker-option'));
        expect(options.map(text)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
        options[0].click();
        await fixture.whenStable();

        expect(document.querySelector('.period-popover')).toBeNull();
        expect(text(element.querySelector('.period-button'))).toBe('Q1 2026 arrow_drop_down');
        expect(financeService.fetchSpendingTotals.mock.calls).toEqual([
            [CalendarPeriod.Monthly, '2026-05-01'],
            [CalendarPeriod.Quarterly, '2026-04-01'],
            [CalendarPeriod.Quarterly, '2026-01-01']
        ]);
    });

    it('CASH-1.1 CASH-1.12 should shorten the period on phones', async () => {
        const fixture = await render(totals, '2025-06-01');
        const { element } = fixture;
        fixture.isCompact.set(true);

        fixture.componentInstance.selection.set({ period: CalendarPeriod.Monthly, start: '2025-09-01' });
        await fixture.whenStable();
        expect(text(element.querySelector('.period-button'))).toBe('Sep 2025 arrow_drop_down');

        fixture.componentInstance.selection.set({ period: 'average', start: '2026-05-01' });
        await fixture.whenStable();
        expect(text(element.querySelector('.period-text'))).toBe('Past 12 months');
    });

    it('CASH-1.1 should mark the period on screen in the picker', async () => {
        const fixture = await render();

        fixture.componentInstance.openPicker();
        await fixture.whenStable();

        const selected = Array.from(document.querySelectorAll('.picker-option[aria-pressed="true"]')).map(text);
        expect(selected).toEqual(['May']);
        fixture.componentInstance.closePicker();
    });

    describe('Average month', () => {
        async function renderAverage(window: Partial<SpendingAverage> = {}) {
            const fixture = await render(totals, undefined, undefined, budget);
            fixture.financeService.fetchSpendingAverage.mockResolvedValue({ ...average, ...window });
            fixture.componentInstance.selection.set({ period: 'average', start: '2026-05-01' });
            await fixture.whenStable();
            return fixture;
        }

        it('CASH-1.12 should show the average month from the dropdown, with nothing to pick', async () => {
            const fixture = await render();
            const { element, financeService } = fixture;

            await choosePeriodType(fixture, 'Average');

            expect(financeService.fetchSpendingAverage).toHaveBeenCalledWith('2026-05-17');
            expect(text(element.querySelector('.period-text'))).toBe('Average month, May 2025 to Apr 2026');
            expect(element.querySelector('.period-button')).toBeNull();
        });

        it('CASH-1.12 should compare each average month with the monthly budget', async () => {
            const { element } = await renderAverage();

            expect(summary(element)).toEqual(['$2,175', '53% of income', '$4,100', '$1,925']);
            expect(budgeted(element)).toEqual(['of $2,050 budgeted', 'of $4,200 budgeted', 'of $2,150 budgeted']);
            expect(sectionRows(element, 'Income')).toEqual(['💼 Paycheck Budget $4,200 $100 under $4,100.00']);
            expect(sectionRows(element, 'Expenses')).toEqual([
                '🏠 Rent Budget $1,500 on budget $1,500.00',
                '🛒 Groceries Budget $400 $25 over $425.00',
                '💡 Utilities Budget $150 $150 under $0.00',
                '🍽️ Dining Budget $100 $100 under $0.00'
            ]);
        });

        it('CASH-1.6 CASH-1.12 should open Transactions for the whole window', async () => {
            const { element } = await renderAverage();

            const rent = Array.from(element.querySelectorAll<HTMLAnchorElement>('a.app-list-row')).find(row =>
                text(row).includes('Rent')
            )!;
            const params = new URL(rent.href).searchParams;
            expect(params.get('startDate')).toBe('2025-05-01');
            expect(params.get('endDate')).toBe('2026-04-30');
        });

        it('CASH-1.12 should name a one-month window by its month, and no window at all without history', async () => {
            const oneMonth = await renderAverage({ startDate: '2026-04-01', months: 1 });
            expect(text(oneMonth.element.querySelector('.period-text'))).toBe('Average month, Apr 2026');
            TestBed.resetTestingModule();

            const none = await renderAverage({ startDate: '2026-05-01', months: 0, totals: [] });
            expect(text(none.element.querySelector('.period-text'))).toBe('Average month');
            expect(text(section(none.element, 'Income').querySelector('.section-total'))).toBe('$0');
        });

        it('CASH-1.12 should open on the average month when the URL asks for it', async () => {
            const { element, financeService } = await render(
                totals,
                undefined,
                undefined,
                [],
                categories,
                '/?period=average'
            );

            expect(financeService.fetchSpendingTotals).not.toHaveBeenCalled();
            expect(text(element.querySelector('.period-text'))).toBe('Average month, May 2025 to Apr 2026');
            expect(text(element.querySelector('.period-type'))).toBe('Average');
        });
    });

    it("CASH-1.10 should show each budgeted category's budget and how the actual compares", async () => {
        const { element } = await render(totals, undefined, undefined, budget);

        expect(sectionRows(element, 'Income')).toEqual(['💼 Paycheck Budget $4,200 $200 under $4,000.00']);
        expect(sectionRows(element, 'Expenses')).toEqual([
            '🏠 Rent Budget $1,500 on budget $1,500.00',
            '🛒 Groceries Budget $400 $100 under $300.00',
            '💡 Utilities Budget $150 $50 over $200.00',
            '🍽️ Dining Budget $100 $100 under $0.00'
        ]);
        // Under on income and over on an expense are the bad ones.
        const bad = Array.from(element.querySelectorAll('.difference.bad')).map(text);
        expect(bad).toEqual(['$200 under', '$50 over']);
        expect(text(section(element, 'Expenses').querySelector('.app-list-header'))).toBe(
            'Category Budget Difference Actual'
        );
    });

    it('CASH-1.10 should multiply the monthly budget by the months in the period', async () => {
        const fixture = await render(totals, undefined, undefined, budget);

        fixture.componentInstance.selection.set({ period: CalendarPeriod.Quarterly, start: '2026-04-01' });
        await fixture.whenStable();

        expect(sectionRows(fixture.element, 'Expenses')[0]).toBe('🏠 Rent Budget $4,500 $3,000 under $1,500.00');
        expect(sectionRows(fixture.element, 'Expenses')[1]).toBe('🛒 Groceries Budget $1,200 $900 under $300.00');
    });

    it('CASH-1.10 should give a group the budgets of its categories added up', async () => {
        const fixture = await render(totals, undefined, undefined, budget);

        fixture.componentInstance.viewMode.set('group');
        await fixture.whenStable();

        expect(sectionRows(fixture.element, 'Expenses')).toEqual([
            'Housing Budget $1,650 $50 over $1,700.00',
            'Food Budget $500 $200 under $300.00'
        ]);
    });

    it('CASH-1.10 should leave out the budget columns when nothing is budgeted', async () => {
        const { element } = await render();

        expect(element.querySelector('.difference')).toBeNull();
        expect(element.querySelector('.app-list-header')).toBeNull();
    });

    it('CASH-1.11 should show what was budgeted under Saved, Income and Expenses', async () => {
        const { element } = await render(totals, undefined, undefined, budget);

        expect(budgeted(element)).toEqual(['of $2,050 budgeted', 'of $4,200 budgeted', 'of $2,150 budgeted']);
    });

    it('CASH-1.11 should show a budgeted total only for a type with streams', async () => {
        const { element } = await render(totals, undefined, undefined, [stream('rent', 1500)]);

        expect(budgeted(element)).toEqual(['of -$1,500 budgeted', 'of $1,500 budgeted']);
        expect(section(element, 'Income').querySelector('.difference')).toBeNull();
    });

    it('CASH-1.6 should open Transactions filtered to the row and every day of the period', async () => {
        const fixture = await render();

        fixture.componentInstance.selection.set({ period: CalendarPeriod.Quarterly, start: '2026-04-01' });
        await fixture.whenStable();

        const rent = Array.from(fixture.element.querySelectorAll<HTMLAnchorElement>('a.app-list-row')).find(row =>
            row.textContent!.includes('Rent')
        )!;
        expect(rent.getAttribute('href')).toBe('/transactions?categoryId=rent&startDate=2026-04-01&endDate=2026-06-30');
    });

    it('CASH-1.1 should put the period between the summary and the sections', async () => {
        const { element } = await render();

        const order = Array.from(element.querySelectorAll('.summary-card, .controls, .section-card')).map(e =>
            ['summary-card', 'controls', 'section-card'].find(name => e.classList.contains(name))
        );
        expect(order).toEqual(['summary-card', 'controls', 'section-card', 'section-card']);
        const controls = Array.from(element.querySelectorAll('.controls > *')).map(e =>
            ['period-type', 'period-button'].find(name => e.classList.contains(name))
        );
        expect(controls).toEqual(['period-type', 'period-button']);
    });

    describe('Essential and Discretionary', () => {
        // Expenses of $2,180: $2,000 essential (rent, utilities, groceries), $100 discretionary (dining), $80 uncategorized.
        const split = [...totals, expense('dining', 100), expense('', 80)];

        function subheaders(element: HTMLElement): string[] {
            return Array.from(section(element, 'Expenses').querySelectorAll('[appListSubheader]')).map(header =>
                Array.from(header.children).map(text).join(' ')
            );
        }

        it('CASH-1.8 should list expenses by category under each necessity in the Category view', async () => {
            const fixture = await render(split);

            expect(subheaders(fixture.element)).toEqual([
                'Essential · 92% $2,000',
                'Discretionary · 5% $100',
                'Unclassified · 4% $80'
            ]);
            expect(sectionRows(fixture.element, 'Expenses')).toEqual([
                '🏠 Rent $1,500.00',
                '🛒 Groceries $300.00',
                '💡 Utilities $200.00',
                '🍽️ Dining $100.00',
                'Uncategorized $80.00'
            ]);
            expect(sectionRows(fixture.element, 'Income')).toEqual(['💼 Paycheck $4,000.00']);
            expect(section(fixture.element, 'Income').querySelector('[appListSubheader]')).toBeNull();
        });

        it('CASH-1.6 TXN-1.11 should open Transactions filtered to Uncategorized from an uncategorized row, by category or group', async () => {
            const fixture = await render(split);
            const uncategorizedLink = () =>
                Array.from(section(fixture.element, 'Expenses').querySelectorAll<HTMLAnchorElement>('a.app-list-row'))
                    .find(row => row.textContent!.includes('Uncategorized'))!
                    .getAttribute('href');

            expect(uncategorizedLink()).toBe(
                '/transactions?categoryId=uncategorized&startDate=2026-05-01&endDate=2026-05-31'
            );

            fixture.componentInstance.viewMode.set('group');
            await fixture.whenStable();
            expect(uncategorizedLink()).toBe(
                '/transactions?categoryId=uncategorized&startDate=2026-05-01&endDate=2026-05-31'
            );
        });

        it('CASH-1.8 should list groups without necessity headings in the Group view', async () => {
            const fixture = await render(split);

            fixture.componentInstance.viewMode.set('group');
            await fixture.whenStable();

            expect(subheaders(fixture.element)).toEqual([]);
        });

        it('CASH-1.8 should leave the headings out while no category has a necessity', async () => {
            const { element } = await render(
                split,
                undefined,
                undefined,
                [],
                categories.map(c => ({ ...c, necessity: null }))
            );

            expect(subheaders(element)).toEqual([]);
            expect(sectionRows(element, 'Expenses')[0]).toBe('🏠 Rent $1,500.00');
        });
    });
});
