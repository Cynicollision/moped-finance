import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CategoryNecessity, CategoryType } from '@shared/finance/enum';
import { Category, CategoryGroup } from '@shared/finance/types';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';
import { CategoryFormModalComponent, CategoryFormModalData } from './category-form-modal.component';

describe('CategoryFormModalComponent', () => {
    const groups = [
        { id: 'transfers', name: 'Transfers', type: CategoryType.Transfer },
        { id: 'housing', name: 'Housing', type: CategoryType.Expense },
        { id: 'work', name: 'Work', type: CategoryType.Income },
        { id: 'food', name: 'Food', type: CategoryType.Expense },
        { id: 'bonus', name: 'Bonuses', type: CategoryType.Income }
    ] as CategoryGroup[];

    async function render(data: CategoryFormModalData) {
        const financeService = {
            createCategory: vi.fn().mockResolvedValue({ id: 'new' }),
            saveCategory: vi.fn().mockResolvedValue({ id: 'cat' })
        };
        TestBed.configureTestingModule({
            imports: [CategoryFormModalComponent],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: data },
                { provide: MatDialogRef, useValue: { close: vi.fn() } },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: { success: vi.fn() } },
                { provide: ModalService, useValue: { requestClose: vi.fn() } }
            ]
        });

        const fixture = TestBed.createComponent(CategoryFormModalComponent);
        await fixture.whenStable();
        return { fixture, element: fixture.nativeElement as HTMLElement, financeService };
    }

    it('CAT-1.19 should list groups by type, then name, labelled with their type', async () => {
        const { fixture, element } = await render({ groups });

        (element.querySelector('.mat-mdc-select-trigger') as HTMLElement).click();
        await fixture.whenStable();

        const options = Array.from(document.querySelectorAll('mat-option')).map(o => o.textContent!.trim());
        expect(options).toEqual([
            'Bonuses (Income)',
            'Work (Income)',
            'Food (Expense)',
            'Housing (Expense)',
            'Transfers (Transfer)'
        ]);
    });

    it('CAT-1.2 should save a category without an icon', async () => {
        const { fixture, element, financeService } = await render({ groups, initialGroupId: 'work' });
        const form = fixture.componentInstance.form;

        expect(element.querySelector('app-emoji-field mat-label')!.textContent).toBe('Icon');

        form.patchValue({ name: 'Paycheck' });
        expect(form.valid).toBe(true);
        await fixture.componentInstance.save();

        expect(financeService.createCategory).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Paycheck', icon: '' })
        );
    });

    function necessityField(element: HTMLElement): Element | undefined {
        return Array.from(element.querySelectorAll('mat-form-field')).find(
            f => f.querySelector('mat-label')!.textContent === 'Necessity'
        );
    }

    it('CAT-3.2 should offer an optional necessity only while an Expense group is selected', async () => {
        const { fixture, element, financeService } = await render({ groups, initialGroupId: 'work' });
        const form = fixture.componentInstance.form;

        expect(necessityField(element)).toBeUndefined();

        form.patchValue({ name: 'Groceries', icon: '🛒', groupId: 'food' });
        await fixture.whenStable();
        expect(necessityField(element)).toBeDefined();
        expect(form.controls.necessity.value).toBeNull();
        expect(form.valid).toBe(true);

        form.patchValue({ necessity: CategoryNecessity.Essential });
        await fixture.componentInstance.save();

        expect(financeService.createCategory).toHaveBeenCalledWith({
            name: 'Groceries',
            icon: '🛒',
            groupId: 'food',
            isActive: true,
            necessity: CategoryNecessity.Essential
        });
    });

    it('CAT-1.17 should clear the necessity of a category moved out of Expense', async () => {
        const category = {
            id: 'cat',
            groupId: 'food',
            name: 'Card',
            icon: '💳',
            isActive: true,
            necessity: CategoryNecessity.Discretionary
        } as Category;
        const { fixture, element, financeService } = await render({ category, groups });

        expect(necessityField(element)).toBeDefined();

        fixture.componentInstance.form.patchValue({ groupId: 'transfers' });
        await fixture.whenStable();
        expect(necessityField(element)).toBeUndefined();
        await fixture.componentInstance.save();

        expect(financeService.saveCategory).toHaveBeenCalledWith(
            expect.objectContaining({ groupId: 'transfers', necessity: null })
        );
    });
});
