import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { CategoryType } from '@shared/finance/enum';
import { Category, CategoryGroup, Transaction } from '@shared/finance/types';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';
import { SplitTransactionModalComponent, SplitTransactionModalData } from './split-transaction-modal.component';

describe('SplitTransactionModalComponent', () => {
    const transaction: Transaction = {
        id: 't1',
        date: '2026-05-01',
        accountId: 'acct',
        categoryId: 'groceries',
        amount: -100,
        merchant: 'Big Store',
        originalStatement: 'BIG STORE 123',
        notes: 'weekly shop',
        isHidden: false,
        adjustsBalance: false,
        splitId: '',
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1)
    };
    const groups = [
        { id: 'food', name: 'Food', type: CategoryType.Expense },
        { id: 'work', name: 'Work', type: CategoryType.Income },
        { id: 'moves', name: 'Moves', type: CategoryType.Transfer }
    ] as CategoryGroup[];
    const categories = [
        { id: 'groceries', name: 'Groceries', icon: '🍎', groupId: 'food', isActive: true },
        { id: 'household', name: 'Household', icon: '', groupId: 'food', isActive: true },
        { id: 'salary', name: 'Salary', icon: '', groupId: 'work', isActive: true },
        { id: 'principal', name: 'Extra Principal', icon: '', groupId: 'moves', isActive: true }
    ] as Category[];

    async function render(data: SplitTransactionModalData = { transaction, parts: [] }) {
        const financeService = {
            fetchCategories: vi.fn().mockResolvedValue(categories),
            fetchCategoryGroups: vi.fn().mockResolvedValue(groups),
            splitTransaction: vi.fn().mockResolvedValue([transaction])
        };
        const dialogRef = { close: vi.fn() };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [SplitTransactionModalComponent],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: data },
                { provide: MatDialogRef, useValue: dialogRef },
                { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: notificationService },
                { provide: ModalService, useValue: { requestClose: vi.fn() } }
            ]
        });

        const fixture = TestBed.createComponent(SplitTransactionModalComponent);
        await fixture.whenStable();
        const component = fixture.componentInstance;
        const element = fixture.nativeElement as HTMLElement;
        const amounts = () => component.parts.controls.map(p => p.controls.amount.value);
        const remaining = () => element.querySelector('.remaining')!.textContent!.replace(/\s+/g, ' ').trim();
        const saveButton = () => element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        async function typeAmount(index: number, value: number) {
            const input = element.querySelectorAll<HTMLInputElement>('input[type="number"]')[index];
            input.value = String(value);
            input.dispatchEvent(new Event('input'));
            await fixture.whenStable();
        }
        return {
            fixture,
            component,
            element,
            financeService,
            dialogRef,
            notificationService,
            amounts,
            remaining,
            saveButton,
            typeAmount
        };
    }

    // A $100 purchase already split into $70 of groceries and $30 of household.
    const splitParts: Transaction[] = [
        { ...transaction, splitId: 's1', amount: -70, notes: '' },
        { ...transaction, id: 't2', splitId: 's1', amount: -30, categoryId: 'household', notes: 'soap' }
    ];

    it("TXN-4.3 should open with two parts, the first with the transaction's category and notes", async () => {
        const { component, element } = await render();

        expect(element.querySelectorAll('section.part')).toHaveLength(2);
        expect(element.querySelector('mat-button-toggle-group')).toBeNull();
        expect(component.parts.getRawValue()).toEqual([
            { id: 't1', amount: null, categoryId: 'groceries', merchant: 'Big Store', notes: 'weekly shop' },
            { id: '', amount: 100, categoryId: '', merchant: 'Big Store', notes: '' }
        ]);
    });

    it('TXN-4.3 should fill the last part with the remainder as the others are typed, so two parts need one amount', async () => {
        const { amounts, remaining, saveButton, typeAmount } = await render();

        await typeAmount(0, 60);

        expect(amounts()).toEqual([60, 40]);
        expect(remaining()).toBe('Remaining: $0.00');
        expect(saveButton().disabled).toBe(false);
    });

    it('TXN-4.2 TXN-4.3 should stop filling the last part once the user edits it, keeping Save off until it adds up', async () => {
        const { amounts, remaining, saveButton, typeAmount } = await render();

        await typeAmount(1, 30);
        await typeAmount(0, 60);

        expect(amounts()).toEqual([60, 30]);
        expect(remaining()).toBe('Remaining: $10.00');
        expect(saveButton().disabled).toBe(true);

        await typeAmount(0, 80);

        expect(remaining()).toBe('Remaining: -$10.00');
        expect(saveButton().disabled).toBe(true);
    });

    it('TXN-4.2 should leave the last part empty when the others already cover the total', async () => {
        const { amounts, typeAmount } = await render();

        await typeAmount(0, 120);

        expect(amounts()).toEqual([120, null]);
    });

    it('TXN-4.3 should give the remainder to a part that is added', async () => {
        const { element, amounts, typeAmount, fixture } = await render();
        await typeAmount(0, 60);

        Array.from(element.querySelectorAll('button'))
            .find(b => b.textContent!.includes('Add part'))!
            .click();
        await fixture.whenStable();
        expect(amounts()).toEqual([60, null, 40]);

        await typeAmount(1, 15);
        expect(amounts()).toEqual([60, 15, 25]);
    });

    it("TXN-4.2 should offer categories of the transaction's type and Transfer categories", async () => {
        const { component } = await render();

        expect(component.categoryOptions('').map(c => c.id)).toEqual(['groceries', 'household', 'principal']);
        expect(component.categoryOptions('h').map(c => c.id)).toEqual(['household']);
    });

    it('TXN-4.2 should offer Income and Transfer categories for uncategorized money in', async () => {
        const { component } = await render({ transaction: { ...transaction, amount: 50, categoryId: '' }, parts: [] });

        expect(component.categoryOptions('').map(c => c.id)).toEqual(['salary', 'principal']);
    });

    it("TXN-4.1 APP-2.8 should save the parts with the transaction's sign, say so and close with them", async () => {
        const { component, financeService, notificationService, dialogRef, typeAmount } = await render();
        await typeAmount(0, 60);
        component.parts.at(1).controls.categoryId.setValue('household');

        await component.save();

        expect(financeService.splitTransaction).toHaveBeenCalledWith('t1', [
            { id: 't1', amount: -60, categoryId: 'groceries', merchant: 'Big Store', notes: 'weekly shop' },
            { amount: -40, categoryId: 'household', merchant: 'Big Store', notes: '' }
        ]);
        expect(notificationService.success).toHaveBeenCalledWith('Transaction split');
        expect(dialogRef.close).toHaveBeenCalledWith([transaction]);
    });

    it('TXN-4.5 should open a split with its parts and total, keep their IDs, and stay open if the server refuses', async () => {
        const { component, element, dialogRef, financeService, amounts } = await render({
            transaction: splitParts[1],
            parts: splitParts
        });
        financeService.splitTransaction.mockResolvedValue(undefined);

        expect(element.querySelector('h2')!.textContent).toContain('Edit Split');
        expect(element.querySelector('.summary-amount')!.textContent).toContain('$100.00');
        expect(amounts()).toEqual([70, 30]);

        await component.save();

        expect(financeService.splitTransaction).toHaveBeenCalledWith('t2', [
            expect.objectContaining({ id: 't1', amount: -70 }),
            expect.objectContaining({ id: 't2', amount: -30, notes: 'soap' })
        ]);
        expect(dialogRef.close).not.toHaveBeenCalled();
    });

    it('TXN-4.2 should refuse a category typed but not chosen', async () => {
        const { component, fixture, saveButton } = await render();
        component.parts.at(0).controls.amount.setValue(60);
        component.parts.at(0).controls.categoryId.setValue('Groc');
        await fixture.whenStable();

        expect(component.parts.at(0).controls.categoryId.hasError('unknownCategory')).toBe(true);
        expect(saveButton().disabled).toBe(true);
    });
});
