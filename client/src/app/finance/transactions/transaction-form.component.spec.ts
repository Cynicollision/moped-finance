import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Category, Transaction } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { FinanceService } from './../finance.service';
import { TransactionFormComponent, TransactionFormMode } from './transaction-form.component';

// Tests run with TZ=America/New_York (vitest-base.config.mjs), where a date read as UTC midnight is the day before.
describe('TransactionFormComponent', () => {
    const transaction: Transaction = {
        id: 't1', date: '2026-05-01', accountId: 'acct', categoryId: '', amount: -10, merchant: 'Shop', originalStatement: '', notes: '',
        isHidden: false, isSplit: false, splitParentId: '', createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 1)
    };

    async function render(mode: TransactionFormMode, value: Transaction | null, categories: Category[] = []) {
        const financeService = {
            fetchCategories: vi.fn().mockResolvedValue(categories),
            fetchAllAccounts: vi.fn().mockResolvedValue([])
        };
        TestBed.configureTestingModule({
            imports: [TransactionFormComponent],
            providers: [
                provideRouter([]),
                { provide: DateProviderService, useValue: { now: () => new Date(2026, 4, 17) } },
                { provide: FinanceService, useValue: financeService }
            ]
        });

        const fixture = TestBed.createComponent(TransactionFormComponent);
        fixture.componentRef.setInput('mode', mode);
        fixture.componentRef.setInput('transaction', value);
        await fixture.whenStable();

        const saved: Partial<Transaction>[] = [];
        fixture.componentInstance.save.subscribe(t => saved.push(t));
        return { fixture, element: fixture.nativeElement as HTMLElement, saved };
    }

    function readonlyValue(element: HTMLElement, label: string): string {
        const field = Array.from(element.querySelectorAll('.readonly-field'))
            .find(f => f.querySelector('.label')!.textContent === label)!;
        return field.querySelector('.value')!.textContent!.trim();
    }

    it('TXN-2.2 should show the transaction\'s own date', async () => {
        const { element } = await render('readonly', transaction);

        expect(readonlyValue(element, 'Date')).toBe('May 1, 2026');
    });

    it('TXN-2.3 should keep the date unchanged when the transaction is saved as it is', async () => {
        const { fixture, saved } = await render('edit', transaction);

        fixture.componentInstance.onSave();

        expect(saved[0].date).toBe('2026-05-01');
    });

    it('TXN-2.1 should default a new transaction to today and save the picked date as YYYY-MM-DD', async () => {
        const { fixture, saved } = await render('create', null);
        const form = fixture.componentInstance.transactionForm;
        form.patchValue({ accountId: 'acct', amount: -5 });

        fixture.componentInstance.onSave();
        form.controls.date.setValue(new Date(2026, 3, 30));
        fixture.componentInstance.onSave();

        expect(saved.map(t => t.date)).toEqual(['2026-05-17', '2026-04-30']);
    });

    describe('category choices', () => {
        const categories = [
            { id: 'food', groupId: 'g', name: 'Groceries', icon: '🛒', isActive: true },
            { id: 'old', groupId: 'g', name: 'Old Gym', icon: '🏋️', isActive: false },
            { id: 'older', groupId: 'g', name: 'Old Club', icon: '🎾', isActive: false }
        ] as Category[];

        it('CAT-4.1 should offer only active categories for a new transaction', async () => {
            const { fixture } = await render('create', null, categories);

            expect(fixture.componentInstance.categoryOptions().map(c => c.name)).toEqual(['Groceries']);
        });

        it('CAT-5.2 should show an empty category as Uncategorized, and save it that way', async () => {
            const { fixture, saved, element } = await render('create', null, categories);
            fixture.componentInstance.transactionForm.patchValue({ accountId: 'acct', amount: -5 });

            fixture.componentInstance.onSave();

            expect(saved[0].categoryId).toBe('');
            expect(element.querySelector<HTMLInputElement>('input[formControlName="category"]')!.placeholder).toBe('Uncategorized');
        });

        it('CAT-5.2 should show Uncategorized when viewing a transaction with no category', async () => {
            const { element } = await render('readonly', { ...transaction, categoryId: '' }, categories);

            expect(readonlyValue(element, 'Category')).toBe('Uncategorized');
        });

        it('CAT-4.2 should keep offering an inactive category the transaction already has', async () => {
            const { fixture } = await render('edit', { ...transaction, categoryId: 'old' }, categories);

            expect(fixture.componentInstance.categoryOptions().map(c => c.name)).toEqual(['Groceries', 'Old Gym']);
            expect(fixture.componentInstance.displayCategory('old')).toBe('🏋️ Old Gym');
        });
    });
});
