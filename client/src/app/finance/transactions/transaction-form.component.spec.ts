import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TransactionDirection } from '@shared/finance/enum';
import { Account, Category, Transaction } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { FinanceService } from './../finance.service';
import { TransactionFormComponent, TransactionFormMode } from './transaction-form.component';

// Tests run with TZ=America/New_York (vitest-base.config.mjs), where a date read as UTC midnight is the day before.
describe('TransactionFormComponent', () => {
    const transaction: Transaction = {
        id: 't1',
        date: '2026-05-01',
        accountId: 'acct',
        categoryId: '',
        amount: -10,
        merchant: 'Shop',
        originalStatement: '',
        notes: '',
        isHidden: false,
        adjustsBalance: false,
        splitId: '',
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1)
    };

    async function render(
        mode: TransactionFormMode,
        value: Transaction | null,
        categories: Category[] = [],
        accounts: Account[] = [],
        defaultAccountId?: string
    ) {
        const financeService = {
            fetchCategories: vi.fn().mockResolvedValue(categories),
            fetchAllAccounts: vi.fn().mockResolvedValue(accounts)
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
        fixture.componentRef.setInput('defaultAccountId', defaultAccountId);
        await fixture.whenStable();

        const saved: Partial<Transaction>[] = [];
        fixture.componentInstance.save.subscribe(t => saved.push(t));
        return { fixture, element: fixture.nativeElement as HTMLElement, saved };
    }

    function readonlyValue(element: HTMLElement, label: string): string {
        const field = Array.from(element.querySelectorAll('.readonly-field')).find(
            f => f.querySelector('.label')!.textContent === label
        )!;
        return field.querySelector('.value')!.textContent!.trim();
    }

    it("TXN-2.2 should show the transaction's own date", async () => {
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
        form.patchValue({ accountId: 'acct', amount: 5, merchant: 'Shop' });

        fixture.componentInstance.onSave();
        form.controls.date.setValue(new Date(2026, 3, 30));
        fixture.componentInstance.onSave();

        expect(saved.map(t => t.date)).toEqual(['2026-05-17', '2026-04-30']);
    });

    it('APP-8.1 should flag a date after today and keep the form from saving', async () => {
        const { fixture, element } = await render('create', null);
        const form = fixture.componentInstance.transactionForm;
        form.patchValue({ accountId: 'acct', amount: 5, merchant: 'Shop' });

        form.controls.date.setValue(new Date(2026, 4, 18));
        form.controls.date.markAsTouched();
        fixture.detectChanges();

        expect(form.invalid).toBe(true);
        expect(element.querySelector('mat-error')!.textContent).toContain("Date can't be after today");
    });

    it('TXN-2.13 should start a new transaction as Money out with a blank amount, and save it negative', async () => {
        const { fixture, element, saved } = await render('create', null);
        const form = fixture.componentInstance.transactionForm;

        expect(form.controls.direction.value).toBe(TransactionDirection.Out);
        expect(element.querySelector<HTMLInputElement>('input[formControlName="amount"]')!.value).toBe('');

        form.patchValue({ accountId: 'acct', amount: 25, merchant: 'Shop' });
        fixture.componentInstance.onSave();
        form.controls.direction.setValue(TransactionDirection.In);
        fixture.componentInstance.onSave();

        expect(saved.map(t => t.amount)).toEqual([-25, 25]);
    });

    it("TXN-2.13 should edit a transaction's amount as its size and direction", async () => {
        const { fixture, element, saved } = await render('edit', { ...transaction, amount: 1250 });
        const form = fixture.componentInstance.transactionForm;
        const toggles = Array.from(element.querySelectorAll('mat-button-toggle')).map(t => t.textContent!.trim());

        expect(toggles).toEqual(['Money out', 'Money in']);
        expect(form.controls.direction.value).toBe(TransactionDirection.In);
        expect(form.controls.amount.value).toBe(1250);

        form.controls.direction.setValue(TransactionDirection.Out);
        fixture.componentInstance.onSave();

        expect(saved[0].amount).toBe(-1250);
    });

    it('TXN-2.2 should show the signed amount when viewing a transaction', async () => {
        const { element } = await render('readonly', transaction);

        expect(readonlyValue(element, 'Amount')).toBe('$10.00');
    });

    it('TXN-2.13 should refuse an amount of 0 or less', async () => {
        const { fixture, element } = await render('create', null);
        const form = fixture.componentInstance.transactionForm;
        form.patchValue({ accountId: 'acct', amount: 0, merchant: 'Shop' });
        form.controls.amount.markAsTouched();
        fixture.detectChanges();

        expect(form.invalid).toBe(true);
        expect(element.querySelector('mat-error')!.textContent).toContain('Amount must be more than 0');
    });

    it('TXN-2.6 should mark the required fields and say which are missing, merchant included', async () => {
        const { fixture, element, saved } = await render('create', null);
        const form = fixture.componentInstance.transactionForm;
        form.markAllAsTouched();
        fixture.detectChanges();

        const required = Array.from(element.querySelectorAll('mat-label'))
            .filter(label => label.closest('mat-form-field')!.querySelector('.mat-mdc-form-field-required-marker'))
            .map(label => label.textContent!.trim());
        const errors = Array.from(element.querySelectorAll('mat-error')).map(e => e.textContent!.trim());
        fixture.componentInstance.onSave();

        expect(required).toEqual(['Amount', 'Account', 'Merchant', 'Date']);
        expect(errors).toEqual(['Amount is required', 'Account is required', 'Merchant is required']);
        expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
        expect(saved).toEqual([]);
    });

    it('TXN-2.11 should un-hide a hidden transaction by clearing Hide Transaction', async () => {
        const { fixture, element, saved } = await render('edit', { ...transaction, isHidden: true });
        const checkbox = element.querySelector<HTMLInputElement>('mat-checkbox input')!;

        expect(checkbox.checked).toBe(true);
        checkbox.click();
        fixture.componentInstance.onSave();

        expect(saved[0].isHidden).toBe(false);
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
            fixture.componentInstance.transactionForm.patchValue({ accountId: 'acct', amount: 5, merchant: 'Shop' });

            fixture.componentInstance.onSave();

            expect(saved[0].categoryId).toBe('');
            expect(element.querySelector<HTMLInputElement>('input[formControlName="category"]')!.placeholder).toBe(
                'Uncategorized'
            );
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

    describe('account choices', () => {
        // By name, as the server sends them.
        const accounts = [
            { id: 'acct', name: 'Checking', isHidden: false },
            { id: 'old', name: 'Old Savings', isHidden: true },
            { id: 'shut', name: 'Shut Card', isHidden: false, closedOn: '2026-05-01' },
            { id: 'visa', name: 'Visa', isHidden: false }
        ] as Account[];

        const names = (component: TransactionFormComponent) => component.accountOptions().map(a => a.name);

        it('TXN-2.1 should offer only open, unhidden accounts for a new transaction', async () => {
            const { fixture } = await render('create', null, [], accounts);

            expect(names(fixture.componentInstance)).toEqual(['Checking', 'Visa']);
        });

        it('TXN-2.1 should keep offering a hidden or closed account the transaction is in, or the form was opened from', async () => {
            const editing = await render('edit', { ...transaction, accountId: 'old' }, [], accounts);
            TestBed.resetTestingModule();
            const adding = await render('create', null, [], accounts, 'shut');

            expect(names(editing.fixture.componentInstance)).toEqual(['Checking', 'Old Savings', 'Visa']);
            expect(names(adding.fixture.componentInstance)).toEqual(['Checking', 'Shut Card', 'Visa']);
            expect(adding.fixture.componentInstance.transactionForm.controls.accountId.value).toBe('shut');
        });
    });

    describe('Adjust balance', () => {
        const accounts = [
            { id: 'cash', name: 'Cash', isHidden: false, isManual: true },
            { id: 'synced', name: 'Synced', isHidden: false, isManual: false }
        ] as Account[];

        const checkbox = (element: HTMLElement) =>
            element.querySelector('mat-checkbox[formControlName="adjustsBalance"]');

        it('TXN-2.8 should offer Adjust balance, checked, only once a manual account is chosen', async () => {
            const { fixture, element, saved } = await render('create', null, [], accounts);
            const form = fixture.componentInstance.transactionForm;
            expect(checkbox(element)).toBeNull();

            form.patchValue({ accountId: 'cash', amount: 5, merchant: 'Shop' });
            fixture.detectChanges();
            expect(checkbox(element)).not.toBeNull();
            expect(form.controls.adjustsBalance.value).toBe(true);
            fixture.componentInstance.onSave();

            form.patchValue({ accountId: 'synced' });
            fixture.detectChanges();
            expect(checkbox(element)).toBeNull();
            fixture.componentInstance.onSave();

            expect(saved.map(t => t.adjustsBalance)).toEqual([true, false]);
        });

        it("TXN-2.8 should edit a transaction's Adjust balance as saved", async () => {
            const { fixture, saved } = await render('edit', { ...transaction, accountId: 'cash' }, [], accounts);
            expect(fixture.componentInstance.transactionForm.controls.adjustsBalance.value).toBe(false);

            fixture.componentInstance.transactionForm.controls.adjustsBalance.setValue(true);
            fixture.componentInstance.onSave();

            expect(saved[0].adjustsBalance).toBe(true);
        });

        it("TXN-2.9 should show Adjusts balance when viewing a manual account's transaction", async () => {
            const manual = await render(
                'readonly',
                { ...transaction, accountId: 'cash', adjustsBalance: true },
                [],
                accounts
            );
            expect(readonlyValue(manual.element, 'Adjusts balance')).toBe('Yes');
            TestBed.resetTestingModule();

            const synced = await render('readonly', { ...transaction, accountId: 'synced' }, [], accounts);
            const labels = Array.from(synced.element.querySelectorAll('.readonly-field .label')).map(
                l => l.textContent
            );
            expect(labels).not.toContain('Adjusts balance');
        });
    });

    describe('split transactions (TXN-4)', () => {
        const categories = [{ id: 'food', name: 'Food', icon: '🍎', isActive: true }] as Category[];
        const parts: Transaction[] = [
            { ...transaction, splitId: 's1', amount: -70, categoryId: 'food' },
            { ...transaction, id: 't2', splitId: 's1', amount: -30, merchant: 'Shop Cafe' }
        ];

        it('TXN-4.5 should list every part of the split with its total, linking to the others', async () => {
            const { fixture, element } = await render('readonly', parts[0], categories);
            fixture.componentRef.setInput('splitParts', parts);
            await fixture.whenStable();

            const rows = Array.from(element.querySelectorAll('li.part')).map(p => p.textContent!.replace(/\s+/g, ''));
            expect(rows).toEqual(['🍎FoodShop$70.00', 'UncategorizedShopCafe$30.00', 'Total$100.00']);
            expect(element.textContent).toContain('Split into 2 parts');
            expect(element.querySelector<HTMLAnchorElement>('li.part a')!.getAttribute('href')).toBe(
                '/transactions/t2'
            );
        });

        it("TXN-4.7 should lock a part's amount on Edit, and save its other fields", async () => {
            const { fixture, element, saved } = await render('edit', parts[0], categories);
            const controls = fixture.componentInstance.transactionForm.controls;

            expect([controls.amount, controls.direction].map(c => c.disabled)).toEqual([true, true]);
            expect([controls.date, controls.accountId, controls.category].map(c => c.enabled)).toEqual([
                true,
                true,
                true
            ]);
            expect(element.querySelector('.split-note')!.textContent).toContain('Change its amount with Edit split.');

            controls.merchant.setValue('Renamed');
            fixture.componentInstance.onSave();
            expect(saved[0]).toMatchObject({ amount: -70, categoryId: 'food', merchant: 'Renamed' });
        });
    });
});
