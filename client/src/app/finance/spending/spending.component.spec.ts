import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CalendarPeriod, SortDirection } from '@shared/core/enum';
import { SpendingTotal, TransactionSearchOptions } from '@shared/finance/contracts';
import { BudgetStreamType, CategoryNecessity, CategoryType } from '@shared/finance/enum';
import { BudgetStream, Category, CategoryGroup } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { LayoutService } from './../../core/layout/layout.service';
import { FinanceService } from './../finance.service';
import { FinanceSpendingComponent } from './spending.component';

describe('FinanceSpendingComponent', () => {
    const created = { createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 1) };
    const groups: CategoryGroup[] = [
        { id: 'income', name: 'Income', type: CategoryType.Income, ...created },
        { id: 'housing', name: 'Housing', type: CategoryType.Expense, ...created },
        { id: 'food', name: 'Food', type: CategoryType.Expense, ...created },
        { id: 'transfers', name: 'Transfers', type: CategoryType.Transfer, ...created }
    ];
    const categories: Category[] = [
        { id: 'pay', groupId: 'income', name: 'Paycheck', icon: '💼', isActive: true, necessity: null, ...created },
        { id: 'rent', groupId: 'housing', name: 'Rent', icon: '🏠', isActive: true, necessity: CategoryNecessity.Essential, ...created },
        { id: 'utilities', groupId: 'housing', name: 'Utilities', icon: '💡', isActive: true, necessity: CategoryNecessity.Essential, ...created },
        { id: 'groceries', groupId: 'food', name: 'Groceries', icon: '🛒', isActive: true, necessity: CategoryNecessity.Essential, ...created },
        { id: 'dining', groupId: 'food', name: 'Dining', icon: '🍽️', isActive: true, necessity: CategoryNecessity.Discretionary, ...created },
        { id: 'card', groupId: 'transfers', name: 'Card Payment', icon: '💳', isActive: true, necessity: null, ...created }
    ];
    const totals: SpendingTotal[] = [
        { categoryId: 'pay', amount: 4000 },
        { categoryId: 'rent', amount: -1500 },
        { categoryId: 'utilities', amount: -200 },
        { categoryId: 'groceries', amount: -300 },
        { categoryId: 'card', amount: -900 }
    ];

    function stream(categoryId: string, amount: number, recurrence = CalendarPeriod.Monthly): BudgetStream {
        return { id: `${categoryId}-${amount}`, type: BudgetStreamType.Expense, name: categoryId, categoryId, amount, recurrence, ...created };
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
    async function render(periodTotals = totals, oldest?: string, newest?: string, budgetStreams: BudgetStream[] = [], withCategories = categories) {
        const edge = (date?: string) => date ? [{ id: date, date }] : [];
        const financeService = {
            fetchCategories: vi.fn().mockResolvedValue(withCategories),
            fetchCategoryGroups: vi.fn().mockResolvedValue(groups),
            fetchBudgetStreams: vi.fn().mockResolvedValue(budgetStreams),
            fetchSpendingTotals: vi.fn().mockResolvedValue(periodTotals),
            fetchTransactions: vi.fn((search: TransactionSearchOptions) =>
                Promise.resolve(search.sortDirection === SortDirection.Asc ? edge(oldest) : edge(newest)))
        };
        TestBed.configureTestingModule({
            imports: [FinanceSpendingComponent],
            providers: [
                provideRouter([]),
                { provide: DateProviderService, useValue: { now: () => new Date(2026, 4, 17), today: () => '2026-05-17' } },
                { provide: LayoutService, useValue: { isCompact: signal(false) } },
                { provide: FinanceService, useValue: financeService }
            ]
        });

        const fixture = TestBed.createComponent(FinanceSpendingComponent);
        await fixture.whenStable();
        return Object.assign(fixture, { financeService, element: fixture.nativeElement as HTMLElement });
    }

    function text(element: Element | null): string {
        return element!.textContent!.replace(/\s+/g, ' ').trim();
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
        return Array.from(element.querySelectorAll('.section-card')).find(card => text(card.querySelector('h2')) === title)!;
    }

    function sectionRows(element: HTMLElement, title: string): string[] {
        return Array.from(section(element, title).querySelectorAll('a.app-list-row'))
            .map(row => Array.from(row.querySelectorAll('.app-list-cell')).map(text).join(' '));
    }

    function button(element: HTMLElement, label: string): HTMLButtonElement {
        return element.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;
    }

    it('CASH-1.3 CASH-1.4 should total income and expenses, ignoring transfers', async () => {
        const { element } = await render();

        expect(summary(element)).toEqual(['$2,000', '50% of income', '$4,000', '$2,000']);
    });

    it('CASH-1.4 should show negative savings signed and red, and expenses never red', async () => {
        const { element } = await render([{ categoryId: 'pay', amount: 1000 }, { categoryId: 'rent', amount: -1500 }]);

        expect(summary(element)).toEqual(['-$500', '-50% of income', '$1,000', '$1,500']);
        const colours = Array.from(element.querySelectorAll('.summary-card :is(.headline, .value) span')).map(span => span.className);
        expect(colours).toEqual(['money-negative', 'money-positive', '']);
    });

    it('CASH-1.4 should show a savings rate of 0% when there is no income', async () => {
        const { element } = await render([{ categoryId: 'rent', amount: -1500 }]);

        expect(summary(element)[1]).toBe('0% of income');
    });

    it('CASH-1.5 should head each section with its total', async () => {
        const { element } = await render();

        expect(text(section(element, 'Income').querySelector('.section-total'))).toBe('$4,000');
        expect(text(section(element, 'Expenses').querySelector('.section-total'))).toBe('$2,000');
    });

    it('CASH-1.3 should count uncategorized money in as income and money out as expenses', async () => {
        const { element } = await render([...totals, { categoryId: '', amount: 50 }, { categoryId: '', amount: -80 }]);

        expect(sectionRows(element, 'Income')).toEqual(['💼 Paycheck $4,000.00', 'Uncategorized $50.00']);
        expect(sectionRows(element, 'Expenses'))
            .toEqual(['🏠 Rent $1,500.00', '🛒 Groceries $300.00', '💡 Utilities $200.00', 'Uncategorized $80.00']);
    });

    it('CASH-1.9 should show an expense category that is net money in as a negative expense', async () => {
        const { element } = await render([...totals, { categoryId: 'groceries', amount: 320 }]);

        expect(sectionRows(element, 'Expenses')).toEqual(['🏠 Rent $1,500.00', '💡 Utilities $200.00', '🛒 Groceries -$20.00']);
        expect(summary(element)[3]).toBe('$1,680');
    });

    it('CASH-1.5 should list amounts by category, largest first', async () => {
        const { element } = await render();

        expect(sectionRows(element, 'Income')).toEqual(['💼 Paycheck $4,000.00']);
        expect(sectionRows(element, 'Expenses')).toEqual(['🏠 Rent $1,500.00', '🛒 Groceries $300.00', '💡 Utilities $200.00']);
    });

    it('CASH-1.5 should switch both sections to category groups with the one Category / Group toggle', async () => {
        const fixture = await render();
        const { element } = fixture;

        expect(element.querySelectorAll('mat-button-toggle-group.view-toggle')).toHaveLength(1);
        Array.from(element.querySelectorAll<HTMLButtonElement>('.view-toggle button')).find(b => text(b) === 'Group')!.click();
        await fixture.whenStable();

        expect(sectionRows(element, 'Income')).toEqual(['Income $4,000.00']);
        expect(sectionRows(element, 'Expenses')).toEqual(['Housing $1,700.00', 'Food $300.00']);
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

    it('CASH-1.1 should open on the current month, and step to the previous and next months', async () => {
        const fixture = await render(totals, '2025-06-01');
        const { element, financeService } = fixture;

        expect(text(element.querySelector('.period-button'))).toBe('May 2026 arrow_drop_down');

        button(element, 'Previous month').click();
        await fixture.whenStable();
        button(element, 'Previous month').click();
        await fixture.whenStable();
        button(element, 'Next month').click();
        await fixture.whenStable();

        expect(text(element.querySelector('.period-button'))).toBe('April 2026 arrow_drop_down');
        expect(financeService.fetchSpendingTotals.mock.calls).toEqual([
            [CalendarPeriod.Monthly, '2026-05-01'],
            [CalendarPeriod.Monthly, '2026-04-01'],
            [CalendarPeriod.Monthly, '2026-03-01'],
            [CalendarPeriod.Monthly, '2026-04-01']
        ]);
    });

    it('CASH-1.1 should not step outside the years on offer', async () => {
        const fixture = await render();
        const { componentInstance: spending, element } = fixture;

        spending.selection.set({ period: CalendarPeriod.Monthly, start: '2026-01-01' });
        await fixture.whenStable();
        expect(button(element, 'Previous month').disabled).toBe(true);
        expect(button(element, 'Next month').disabled).toBe(false);

        spending.selection.set({ period: CalendarPeriod.Yearly, start: '2026-01-01' });
        await fixture.whenStable();
        expect(button(element, 'Previous year').disabled).toBe(true);
        expect(button(element, 'Next year').disabled).toBe(true);
    });

    it('CASH-1.1 should choose a quarter from the picker, then step a quarter at a time', async () => {
        const fixture = await render();
        const { componentInstance: spending, element, financeService } = fixture;

        spending.openPicker();
        spending.pickerPeriod.set(CalendarPeriod.Quarterly);
        await fixture.whenStable();
        const options = Array.from(document.querySelectorAll<HTMLButtonElement>('.picker-option'));
        expect(options.map(text)).toEqual(['Q1', 'Q2', 'Q3', 'Q4']);
        options[0].click();
        await fixture.whenStable();

        expect(document.querySelector('.period-popover')).toBeNull();
        expect(text(element.querySelector('.period-button'))).toBe('Q1 2026 arrow_drop_down');

        button(element, 'Next quarter').click();
        await fixture.whenStable();

        expect(financeService.fetchSpendingTotals.mock.calls).toEqual([
            [CalendarPeriod.Monthly, '2026-05-01'],
            [CalendarPeriod.Quarterly, '2026-01-01'],
            [CalendarPeriod.Quarterly, '2026-04-01']
        ]);
    });

    it('CASH-1.1 should mark the period on screen in the picker', async () => {
        const fixture = await render();

        fixture.componentInstance.openPicker();
        await fixture.whenStable();

        const selected = Array.from(document.querySelectorAll('.picker-option[aria-pressed="true"]')).map(text);
        expect(selected).toEqual(['May']);
        fixture.componentInstance.closePicker();
    });

    it('CASH-1.10 should show each budgeted category\'s budget and how the actual compares', async () => {
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
        expect(text(section(element, 'Expenses').querySelector('.app-list-header'))).toBe('Category Budget Difference Actual');
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

        const rent = Array.from(fixture.element.querySelectorAll<HTMLAnchorElement>('a.app-list-row'))
            .find(row => row.textContent!.includes('Rent'))!;
        expect(rent.getAttribute('href')).toBe('/transactions?categoryId=rent&startDate=2026-04-01&endDate=2026-06-30');
    });

    it('CASH-1.5 should put the Category / Group switch between the summary and the sections', async () => {
        const { element } = await render();

        const order = Array.from(element.querySelectorAll('.summary-card, .view-toggle, .section-card'))
            .map(e => ['summary-card', 'view-toggle', 'section-card'].find(name => e.classList.contains(name)));
        expect(order).toEqual(['summary-card', 'view-toggle', 'section-card', 'section-card']);
        expect(Array.from(element.querySelectorAll('mat-button-toggle')).map(text)).toEqual(['Category', 'Group']);
    });

    describe('Essential and Discretionary', () => {
        // Expenses of $2,180: $2,000 essential (rent, utilities, groceries), $100 discretionary (dining), $80 uncategorized.
        const split = [...totals, { categoryId: 'dining', amount: -100 }, { categoryId: '', amount: -80 }];

        function subheaders(element: HTMLElement): string[] {
            return Array.from(section(element, 'Expenses').querySelectorAll('[appListSubheader]'))
                .map(header => Array.from(header.children).map(text).join(' '));
        }

        it('CASH-1.8 should list expenses by category under each necessity in the Category view', async () => {
            const fixture = await render(split);

            expect(subheaders(fixture.element)).toEqual(['Essential · 92% $2,000', 'Discretionary · 5% $100', 'Unclassified · 4% $80']);
            expect(sectionRows(fixture.element, 'Expenses')).toEqual([
                '🏠 Rent $1,500.00', '🛒 Groceries $300.00', '💡 Utilities $200.00', '🍽️ Dining $100.00', 'Uncategorized $80.00'
            ]);
            expect(sectionRows(fixture.element, 'Income')).toEqual(['💼 Paycheck $4,000.00']);
            expect(section(fixture.element, 'Income').querySelector('[appListSubheader]')).toBeNull();
        });

        it('CASH-1.8 should list groups without necessity headings in the Group view', async () => {
            const fixture = await render(split);

            fixture.componentInstance.viewMode.set('group');
            await fixture.whenStable();

            expect(subheaders(fixture.element)).toEqual([]);
        });

        it('CASH-1.8 should leave the headings out while no category has a necessity', async () => {
            const { element } = await render(split, undefined, undefined, [], categories.map(c => ({ ...c, necessity: null })));

            expect(subheaders(element)).toEqual([]);
            expect(sectionRows(element, 'Expenses')[0]).toBe('🏠 Rent $1,500.00');
        });
    });
});
