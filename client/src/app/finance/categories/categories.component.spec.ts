import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { CategoryNecessity, CategoryType } from '@shared/finance/enum';
import { Category, CategoryGroup } from '@shared/finance/types';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';
import { FinanceCategoriesComponent } from './categories.component';

describe('FinanceCategoriesComponent', () => {
    async function render(groups: CategoryGroup[], categories: Category[]) {
        TestBed.configureTestingModule({
            imports: [FinanceCategoriesComponent],
            providers: [
                provideRouter([]),
                {
                    provide: FinanceService,
                    useValue: {
                        fetchCategoryGroups: vi.fn().mockResolvedValue(groups),
                        fetchCategories: vi.fn().mockResolvedValue(categories)
                    }
                },
                { provide: ModalService, useValue: { open: vi.fn() } },
                { provide: NotificationService, useValue: { error: vi.fn() } }
            ]
        });

        const fixture = TestBed.createComponent(FinanceCategoriesComponent);
        await fixture.whenStable();
        return fixture.nativeElement as HTMLElement;
    }

    function sections(element: HTMLElement) {
        return Array.from(element.querySelectorAll('.category-section-wrapper')).map(section => ({
            title: section.querySelector('h2')!.textContent!.trim(),
            groups: Array.from(section.querySelectorAll('.group-card h3')).map(h => h.textContent!.trim()),
            categories: Array.from(section.querySelectorAll('.category-row .name')).map(n => n.textContent!.trim()),
            empty: section.querySelector('.empty-state')?.textContent!.trim()
        }));
    }

    it('CAT-1.3 should show Income, Expenses and Transfers, each with its groups by name', async () => {
        const groups = [
            { id: 'transfers', name: 'Transfers', type: CategoryType.Transfer },
            { id: 'housing', name: 'Housing', type: CategoryType.Expense },
            { id: 'food', name: 'Food', type: CategoryType.Expense },
            { id: 'work', name: 'Work', type: CategoryType.Income }
        ] as CategoryGroup[];
        const categories = [
            { id: 'cc', groupId: 'transfers', name: 'Credit Card Payment', icon: '💳', isActive: true },
            { id: 'rent', groupId: 'housing', name: 'Rent', icon: '🏠', isActive: true },
            { id: 'pay', groupId: 'work', name: 'Paycheck', icon: '💼', isActive: true }
        ] as Category[];

        const element = await render(groups, categories);

        expect(sections(element)).toEqual([
            { title: 'Income', groups: ['Work'], categories: ['Paycheck'], empty: undefined },
            { title: 'Expenses', groups: ['Food', 'Housing'], categories: ['Rent'], empty: undefined },
            { title: 'Transfers', groups: ['Transfers'], categories: ['Credit Card Payment'], empty: undefined }
        ]);
    });

    it('CAT-1.5 should say when a section has no groups', async () => {
        const element = await render([], []);

        expect(sections(element).map(s => s.empty)).toEqual([
            'No income groups found.',
            'No expense groups found.',
            'No transfer groups found.'
        ]);
    });

    it("CAT-3.3 should show an expense category's necessity in its row, when it has one", async () => {
        const groups = [{ id: 'food', name: 'Food', type: CategoryType.Expense }] as CategoryGroup[];
        const categories = [
            {
                id: 'groceries',
                groupId: 'food',
                name: 'Groceries',
                icon: '🛒',
                isActive: true,
                necessity: CategoryNecessity.Essential
            },
            {
                id: 'coffee',
                groupId: 'food',
                name: 'Coffee',
                icon: '☕',
                isActive: true,
                necessity: CategoryNecessity.Discretionary
            },
            { id: 'snacks', groupId: 'food', name: 'Snacks', icon: '🍿', isActive: true, necessity: null }
        ] as Category[];

        const element = await render(groups, categories);

        const rows = Array.from(element.querySelectorAll('.category-row')).map(row => [
            row.querySelector('.name')!.textContent!.trim(),
            row.querySelector('.necessity')?.textContent!.trim()
        ]);
        expect(rows).toEqual([
            ['Coffee', 'Discretionary'],
            ['Groceries', 'Essential'],
            ['Snacks', undefined]
        ]);
    });
});
