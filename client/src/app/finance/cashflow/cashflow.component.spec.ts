import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CashflowStream } from '@shared/finance/contracts';
import { CategoryClass } from '@shared/finance/enum';
import { Category, CategoryGroup } from '@shared/finance/types';
import { FinanceService } from './../finance.service';
import { FinanceCashflowComponent } from './cashflow.component';

describe('FinanceCashflowComponent', () => {
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
    const streams: CashflowStream[] = [
        { categoryId: 'pay', amount: 4000 },
        { categoryId: 'rent', amount: -1500 },
        { categoryId: 'utilities', amount: -200 },
        { categoryId: 'groceries', amount: -300 },
        { categoryId: 'card', amount: -900 }
    ];

    // Renders Cashflow once its categories and the period's totals have loaded.
    async function render() {
        const financeService = {
            fetchCategories: vi.fn().mockResolvedValue(categories),
            fetchCategoryGroups: vi.fn().mockResolvedValue(groups),
            fetchCashflowStreams: vi.fn().mockResolvedValue(streams)
        };
        TestBed.configureTestingModule({
            imports: [FinanceCashflowComponent],
            providers: [provideRouter([]), { provide: FinanceService, useValue: financeService }]
        });

        const fixture = TestBed.createComponent(FinanceCashflowComponent);
        await fixture.whenStable();
        return fixture;
    }

    function summaryCards(element: HTMLElement): string[] {
        return Array.from(element.querySelectorAll('.summary-card .value')).map(e => e.textContent!.trim());
    }

    function sectionRows(element: HTMLElement, title: string): string[] {
        const section = Array.from(element.querySelectorAll('.section-card'))
            .find(card => card.querySelector('.card-title')!.textContent === title)!;
        return Array.from(section.querySelectorAll('tr.mat-mdc-row')).map(row => row.textContent!.replace(/\s+/g, ' ').trim());
    }

    it('CASH-1.3 CASH-1.4 should total income and expenses, ignoring transfers', async () => {
        const fixture = await render();

        expect(summaryCards(fixture.nativeElement)).toEqual(['$4,000', '$2,000', '$2,000', '50%']);
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
});
