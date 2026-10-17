import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CalendarPeriod } from '@shared/core/enum';
import { SpendingAverage } from '@shared/finance/contracts';
import { BudgetStreamType, CategoryNecessity, CategoryType } from '@shared/finance/enum';
import { BudgetStream, Category, CategoryGroup } from '@shared/finance/types';
import { DateProviderService } from './../core/date-provider.service';
import { ModalService } from './../core/modal/modal.service';
import { FinanceService } from './../common/finance.service';
import { BudgetComponent } from './budget.component';
import { BudgetFormModalComponent } from './budget-form-modal.component';

describe('BudgetComponent', () => {
    const groups = [
        { id: 'income', name: 'Income', type: CategoryType.Income },
        { id: 'housing', name: 'Housing', type: CategoryType.Expense },
        { id: 'food', name: 'Food', type: CategoryType.Expense }
    ] as CategoryGroup[];
    const categories = [
        { id: 'pay', groupId: 'income', name: 'Paycheck', icon: '💼' },
        { id: 'rent', groupId: 'housing', name: 'Rent', icon: '🏠' },
        { id: 'groceries', groupId: 'food', name: 'Groceries', icon: '🛒' },
        { id: 'insurance', groupId: 'housing', name: 'Insurance', icon: '🛡️' }
    ] as Category[];
    let nextId = 0;
    const stream = (
        type: BudgetStreamType,
        name: string,
        categoryId: string,
        amount: number,
        recurrence = CalendarPeriod.Monthly
    ) => ({ id: `BS${++nextId}`, type, name, categoryId, amount, recurrence }) as BudgetStream;
    const streams = [
        stream(BudgetStreamType.Expense, 'Home insurance', 'insurance', 600, CalendarPeriod.Yearly),
        stream(BudgetStreamType.Expense, 'Rent', 'rent', 1500),
        stream(BudgetStreamType.Expense, 'Groceries', 'groceries', 300, CalendarPeriod.Quarterly),
        stream(BudgetStreamType.Expense, 'Takeout', 'groceries', 100),
        stream(BudgetStreamType.Income, 'Salary', 'pay', 3000)
    ];

    const average: SpendingAverage = {
        startDate: '2025-05-01',
        endDate: '2026-04-30',
        months: 12,
        totals: [{ categoryId: 'rent', type: CategoryType.Expense, amount: 1500 }],
        transfers: []
    };

    async function render(budgetStreams = streams, withCategories = categories) {
        const financeService = {
            fetchCategories: vi.fn().mockResolvedValue(withCategories),
            fetchCategoryGroups: vi.fn().mockResolvedValue(groups),
            fetchBudgetStreams: vi.fn().mockResolvedValue(budgetStreams),
            fetchSpendingAverage: vi.fn().mockResolvedValue(average)
        };
        const modalService = { open: vi.fn().mockResolvedValue(undefined) };
        TestBed.configureTestingModule({
            imports: [BudgetComponent],
            providers: [
                provideRouter([]),
                { provide: FinanceService, useValue: financeService },
                { provide: ModalService, useValue: modalService },
                { provide: DateProviderService, useValue: { today: () => '2026-05-17' } }
            ]
        });

        const fixture = TestBed.createComponent(BudgetComponent);
        await fixture.whenStable();
        return { fixture, element: fixture.nativeElement as HTMLElement, modalService, financeService };
    }

    function section(element: HTMLElement, title: string): HTMLElement {
        return Array.from(element.querySelectorAll<HTMLElement>('.section-card')).find(
            card => card.querySelector('h2')!.textContent === title
        )!;
    }

    function streamNames(element: HTMLElement, title: string): string[] {
        return Array.from(section(element, title).querySelectorAll('[appListCell="name"]')).map(cell =>
            cell.textContent!.trim()
        );
    }

    function summary(element: HTMLElement): string[] {
        return Array.from(element.querySelectorAll('.summary-card app-money')).map(money => money.textContent!.trim());
    }

    it('BUD-1.2 should show Income, Expenses and Savings, saying when one has no streams', async () => {
        const { element } = await render();

        expect(Array.from(element.querySelectorAll('.section-card h2')).map(h => h.textContent)).toEqual([
            'Income',
            'Expenses',
            'Savings'
        ]);
        expect(streamNames(element, 'Income')).toEqual(['Salary']);
        expect(section(element, 'Savings').querySelector('app-list')).toBeNull();
        expect(section(element, 'Savings').querySelector('.empty')!.textContent).toBe('No savings planned yet.');
    });

    it('BUD-1.5 should order streams by recurrence, then group, then category', async () => {
        const { element } = await render();

        expect(streamNames(element, 'Expenses')).toEqual(['Takeout', 'Rent', 'Groceries', 'Home insurance']);
    });

    it('BUD-1.6 BUD-1.10 should total each section and what is left over, for the chosen period', async () => {
        const { fixture, element } = await render();

        // Expenses: 1,500 + 100 a month, 300 a quarter (100 a month) and 600 a year (50 a month).
        expect(summary(element)).toEqual(['$1,250', '$3,000', '$1,750', '$0']);
        expect(section(element, 'Expenses').querySelector('.section-total')!.textContent!.trim()).toBe('$1,750');

        fixture.componentInstance.period.set(CalendarPeriod.Yearly);
        await fixture.whenStable();

        expect(summary(element)).toEqual(['$15,000', '$36,000', '$21,000', '$0']);
    });

    it('BUD-1.10 should show a negative Left over in red', async () => {
        const { element } = await render([
            stream(BudgetStreamType.Income, 'Salary', 'pay', 1000),
            stream(BudgetStreamType.Expense, 'Rent', 'rent', 1500)
        ]);

        const leftOver = element.querySelector('.left-over app-money')!;
        expect(leftOver.textContent!.trim()).toBe('-$500');
        expect(leftOver.querySelector('span')!.className).toBe('money-negative');
    });

    it("BUD-1.3 should add a stream of the section's type in a side panel", async () => {
        const { element, modalService } = await render();

        const addLabels = Array.from(element.querySelectorAll('.section-header button')).map(b =>
            b.getAttribute('aria-label')
        );
        expect(addLabels).toEqual(['Add Income', 'Add Expense', 'Add Savings']);

        section(element, 'Savings').querySelector<HTMLButtonElement>('[aria-label="Add Savings"]')!.click();

        expect(modalService.open).toHaveBeenCalledWith(
            BudgetFormModalComponent,
            expect.objectContaining({ type: BudgetStreamType.Savings }),
            { size: 'panel' }
        );
    });

    it("BUD-1.8 should give the panel the average month as of today, and every stream for the category's others", async () => {
        const { element, modalService, financeService } = await render();

        section(element, 'Expenses').querySelector<HTMLButtonElement>('[aria-label="Add Expense"]')!.click();

        expect(financeService.fetchSpendingAverage).toHaveBeenCalledWith('2026-05-17');
        expect(modalService.open).toHaveBeenCalledWith(
            BudgetFormModalComponent,
            expect.objectContaining({ type: BudgetStreamType.Expense, streams, average }),
            { size: 'panel' }
        );
    });

    describe('Essential and Discretionary', () => {
        const withNecessity = (necessities: Record<string, CategoryNecessity>) =>
            categories.map(c => ({ ...c, necessity: necessities[c.id] ?? null }));

        function subheaders(element: HTMLElement): string[] {
            return Array.from(section(element, 'Expenses').querySelectorAll('[appListSubheader]')).map(header =>
                Array.from(header.children)
                    .map(child => child.textContent!.trim())
                    .join(' ')
            );
        }

        it('BUD-1.7 should list expenses under Essential and Discretionary, for the chosen period', async () => {
            const { fixture, element } = await render(
                streams,
                withNecessity({
                    rent: CategoryNecessity.Essential,
                    insurance: CategoryNecessity.Essential,
                    groceries: CategoryNecessity.Discretionary
                })
            );

            // Essential: rent 1,500 and insurance 50 a month. Discretionary: groceries 100 and takeout 100 a month.
            expect(element.querySelector('.summary-card .split-part')).toBeNull();
            expect(subheaders(element)).toEqual(['Essential $1,550', 'Discretionary $200']);
            expect(streamNames(element, 'Expenses')).toEqual(['Rent', 'Home insurance', 'Takeout', 'Groceries']);

            fixture.componentInstance.period.set(CalendarPeriod.Yearly);
            await fixture.whenStable();

            expect(subheaders(element)).toEqual(['Essential $18,600', 'Discretionary $2,400']);
        });

        it('BUD-1.7 should show a heading only for a part that has streams', async () => {
            const { element } = await render(streams, withNecessity({ rent: CategoryNecessity.Essential }));

            expect(subheaders(element)).toEqual(['Essential $1,500', 'Unclassified $250']);
            expect(streamNames(element, 'Expenses')).toEqual(['Rent', 'Takeout', 'Groceries', 'Home insurance']);
        });

        it('BUD-1.7 should leave the split out while no expense category has a necessity', async () => {
            const { element } = await render();

            expect(subheaders(element)).toEqual([]);
        });
    });
});
