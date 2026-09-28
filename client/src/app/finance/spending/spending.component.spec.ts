import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CalendarPeriod, SortDirection } from '@shared/core/enum';
import { SpendingTotal, TransactionSearchOptions } from '@shared/finance/contracts';
import { CategoryClass } from '@shared/finance/enum';
import { Category, CategoryGroup } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { FinanceService } from './../finance.service';
import { FinanceSpendingComponent } from './spending.component';

describe('FinanceSpendingComponent', () => {
    const created = { createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 1) };
    const groups: CategoryGroup[] = [
        { id: 'income', name: 'Income', class: CategoryClass.Income, ...created },
        { id: 'housing', name: 'Housing', class: CategoryClass.Expense, ...created },
        { id: 'food', name: 'Food', class: CategoryClass.Expense, ...created },
        { id: 'transfers', name: 'Transfers', class: CategoryClass.Transfer, ...created }
    ];
    const categories: Category[] = [
        { id: 'pay', groupId: 'income', name: 'Paycheck', icon: '💼', isActive: true, ...created },
        { id: 'rent', groupId: 'housing', name: 'Rent', icon: '🏠', isActive: true, ...created },
        { id: 'utilities', groupId: 'housing', name: 'Utilities', icon: '💡', isActive: true, ...created },
        { id: 'groceries', groupId: 'food', name: 'Groceries', icon: '🛒', isActive: true, ...created },
        { id: 'card', groupId: 'transfers', name: 'Card Payment', icon: '💳', isActive: true, ...created }
    ];
    const totals: SpendingTotal[] = [
        { categoryId: 'pay', amount: 4000 },
        { categoryId: 'rent', amount: -1500 },
        { categoryId: 'utilities', amount: -200 },
        { categoryId: 'groceries', amount: -300 },
        { categoryId: 'card', amount: -900 }
    ];

    // Renders Spending once its categories and the period's totals have loaded. The transactions are the oldest and
    // newest, which bound the years offered.
    async function render(periodTotals = totals, oldest?: string, newest?: string) {
        const edge = (date?: string) => date ? [{ id: date, date }] : [];
        const financeService = {
            fetchCategories: vi.fn().mockResolvedValue(categories),
            fetchCategoryGroups: vi.fn().mockResolvedValue(groups),
            fetchSpendingTotals: vi.fn().mockResolvedValue(periodTotals),
            fetchTransactions: vi.fn((search: TransactionSearchOptions) =>
                Promise.resolve(search.sortDirection === SortDirection.Asc ? edge(oldest) : edge(newest)))
        };
        TestBed.configureTestingModule({
            imports: [FinanceSpendingComponent],
            providers: [
                provideRouter([]),
                { provide: DateProviderService, useValue: { now: () => new Date(2026, 4, 17), today: () => '2026-05-17' } },
                { provide: FinanceService, useValue: financeService }
            ]
        });

        const fixture = TestBed.createComponent(FinanceSpendingComponent);
        await fixture.whenStable();
        return Object.assign(fixture, { financeService });
    }

    function summaryCards(element: HTMLElement): string[] {
        return Array.from(element.querySelectorAll('.summary-card .value')).map(e => e.textContent!.trim());
    }

    function sectionRows(element: HTMLElement, title: string): string[] {
        const section = Array.from(element.querySelectorAll('.section-card'))
            .find(card => card.querySelector('.card-title')!.textContent === title)!;
        return Array.from(section.querySelectorAll('a.app-list-row'))
            .map(row => Array.from(row.querySelectorAll('.app-list-cell')).map(cell => cell.textContent!.trim()).join(' '));
    }

    it('CASH-1.3 CASH-1.4 should total income and expenses, ignoring transfers', async () => {
        const fixture = await render();

        expect(summaryCards(fixture.nativeElement)).toEqual(['$4,000', '$2,000', '$2,000', '50%']);
    });

    it('CASH-1.4 should show negative savings signed and red, and expenses never red', async () => {
        const fixture = await render([{ categoryId: 'pay', amount: 1000 }, { categoryId: 'rent', amount: -1500 }]);
        const element = fixture.nativeElement as HTMLElement;

        expect(summaryCards(element)).toEqual(['$1,000', '$1,500', '-$500', '-50%']);
        const colours = Array.from(element.querySelectorAll('.summary-card app-money span')).map(span => span.className);
        expect(colours).toEqual(['money-positive', '', 'money-negative']);
    });

    it('CASH-1.9 should show an expense category that is net money in as a negative expense', async () => {
        const fixture = await render([...totals, { categoryId: 'groceries', amount: 320 }]);

        expect(sectionRows(fixture.nativeElement, 'Expenses')).toEqual(['🏠 Rent $1,500.00', '💡 Utilities $200.00', '🛒 Groceries -$20.00']);
        expect(summaryCards(fixture.nativeElement)[1]).toBe('$1,680');
    });

    it('CASH-1.1 should offer every year from the oldest transaction to the newest, and the current year', async () => {
        const fixture = await render(totals, '2023-02-10', '2026-04-30');

        expect(fixture.componentInstance.years()).toEqual([2023, 2024, 2025, 2026]);
    });

    it('CASH-1.1 should offer only the current year when there are no transactions', async () => {
        const fixture = await render();

        expect(fixture.componentInstance.years()).toEqual([2026]);
    });

    it('CASH-1.5 should list amounts by category, largest first', async () => {
        const fixture = await render();

        expect(sectionRows(fixture.nativeElement, 'Income')).toEqual(['💼 Paycheck $4,000.00']);
        expect(sectionRows(fixture.nativeElement, 'Expenses')).toEqual(['🏠 Rent $1,500.00', '🛒 Groceries $300.00', '💡 Utilities $200.00']);
    });

    it('CASH-1.5 should list amounts by category group when the view switches to Group', async () => {
        const fixture = await render();

        fixture.componentInstance.viewMode.set('group');
        await fixture.whenStable();

        expect(sectionRows(fixture.nativeElement, 'Expenses')).toEqual(['Housing $1,700.00', 'Food $300.00']);
    });

    it('CASH-1.2 should ask for each period by its first day, reloading when the period changes', async () => {
        const fixture = await render();
        const { componentInstance: spending, financeService } = fixture;

        spending.selectedPeriod.set(CalendarPeriod.Quarterly);
        await fixture.whenStable();
        spending.selectedPeriod.set(CalendarPeriod.Yearly);
        await fixture.whenStable();

        expect(financeService.fetchSpendingTotals.mock.calls).toEqual([
            [CalendarPeriod.Monthly, '2026-05-01'],
            [CalendarPeriod.Quarterly, '2026-04-01'],
            [CalendarPeriod.Yearly, '2026-01-01']
        ]);
    });

    it('CASH-1.6 should open Transactions filtered to the row and every day of the period', async () => {
        const fixture = await render();

        fixture.componentInstance.selectedPeriod.set(CalendarPeriod.Quarterly);
        await fixture.whenStable();

        const rent = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLAnchorElement>('a.app-list-row'))
            .find(row => row.textContent!.includes('Rent'))!;
        expect(rent.getAttribute('href')).toBe('/transactions?categoryId=rent&startDate=2026-04-01&endDate=2026-06-30');
    });
});
