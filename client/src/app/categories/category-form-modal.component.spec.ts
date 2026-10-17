import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CategoryNecessity, CategoryType } from '@shared/finance/enum';
import { Category, CategoryGroup, CategoryUsage } from '@shared/finance/types';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { FinanceService } from './../common/finance.service';
import { CategoryDeleteModalComponent } from './category-delete-modal.component';
import { CategoryFormModalComponent, CategoryFormModalData } from './category-form-modal.component';

describe('CategoryFormModalComponent', () => {
    const groups = [
        { id: 'transfers', name: 'Transfers', type: CategoryType.Transfer },
        { id: 'housing', name: 'Housing', type: CategoryType.Expense },
        { id: 'work', name: 'Work', type: CategoryType.Income },
        { id: 'food', name: 'Food', type: CategoryType.Expense },
        { id: 'bonus', name: 'Bonuses', type: CategoryType.Income }
    ] as CategoryGroup[];

    async function render(
        data: CategoryFormModalData,
        usage: CategoryUsage = { transactionCount: 0, budgetStreamCount: 0 }
    ) {
        const financeService = {
            createCategory: vi.fn().mockResolvedValue({ id: 'new' }),
            saveCategory: vi.fn().mockResolvedValue({ id: 'cat' }),
            fetchCategoryUsage: vi.fn().mockResolvedValue(usage),
            deleteCategory: vi.fn().mockResolvedValue(true)
        };
        const dialogRef = { close: vi.fn() };
        const notificationService = { success: vi.fn() };
        const modalService = {
            requestClose: vi.fn(),
            confirm: vi.fn().mockResolvedValue(true),
            open: vi.fn().mockResolvedValue(undefined)
        };
        TestBed.configureTestingModule({
            imports: [CategoryFormModalComponent],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: data },
                { provide: MatDialogRef, useValue: dialogRef },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: notificationService },
                { provide: ModalService, useValue: modalService }
            ]
        });

        const fixture = TestBed.createComponent(CategoryFormModalComponent);
        await fixture.whenStable();
        return {
            fixture,
            element: fixture.nativeElement as HTMLElement,
            financeService,
            dialogRef,
            notificationService,
            modalService
        };
    }

    function button(element: HTMLElement, label: string): HTMLButtonElement | undefined {
        return Array.from(element.querySelectorAll('button')).find(b => b.textContent!.trim() === label);
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

    describe('deleting', () => {
        const rent = {
            id: 'rent',
            groupId: 'housing',
            name: 'Rent',
            icon: '🏠',
            isActive: true,
            necessity: null
        } as Category;
        const mortgage = { ...rent, id: 'mortgage', name: 'Mortgage' } as Category;

        it('CAT-4.4 should not offer Delete while creating', async () => {
            const { element, financeService } = await render({ groups });

            expect(button(element, 'Delete')).toBeUndefined();
            expect(financeService.fetchCategoryUsage).not.toHaveBeenCalled();
        });

        it('CAT-4.4 should delete a category no transactions use after a plain confirmation', async () => {
            const { element, fixture, financeService, modalService, dialogRef, notificationService } = await render({
                category: rent,
                groups,
                categories: [rent, mortgage]
            });

            expect(financeService.fetchCategoryUsage).toHaveBeenCalledWith('rent');
            button(element, 'Delete')!.click();
            await fixture.whenStable();

            expect(modalService.confirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: 'Delete Category',
                    message: 'Delete 🏠 Rent? No transactions use it.'
                })
            );
            expect(modalService.open).not.toHaveBeenCalled();
            expect(financeService.deleteCategory).toHaveBeenCalledWith('rent', undefined);
            expect(notificationService.success).toHaveBeenCalledWith('Category deleted');
            expect(dialogRef.close).toHaveBeenCalledWith(true);
        });

        it('CAT-4.4 should ask where the transactions go, and move them there', async () => {
            const { element, fixture, financeService, modalService, dialogRef } = await render(
                { category: rent, groups, categories: [rent, mortgage] },
                { transactionCount: 12, budgetStreamCount: 0 }
            );
            modalService.open.mockResolvedValue({ moveToId: 'mortgage' });

            button(element, 'Delete')!.click();
            await fixture.whenStable();

            expect(modalService.confirm).not.toHaveBeenCalled();
            expect(modalService.open).toHaveBeenCalledWith(
                CategoryDeleteModalComponent,
                { category: rent, transactionCount: 12, groups, categories: [rent, mortgage] },
                { size: 'small' }
            );
            expect(financeService.deleteCategory).toHaveBeenCalledWith('rent', 'mortgage');
            expect(dialogRef.close).toHaveBeenCalledWith(true);
        });

        it('CAT-4.4 should leave the transactions Uncategorized when that is the choice', async () => {
            const { element, fixture, financeService, modalService } = await render(
                { category: rent, groups, categories: [rent, mortgage] },
                { transactionCount: 1, budgetStreamCount: 0 }
            );
            modalService.open.mockResolvedValue({ moveToId: '' });

            button(element, 'Delete')!.click();
            await fixture.whenStable();

            expect(financeService.deleteCategory).toHaveBeenCalledWith('rent', undefined);
        });

        it('CAT-4.4 should delete nothing when the confirmation is cancelled', async () => {
            const { element, fixture, financeService, dialogRef } = await render(
                { category: rent, groups, categories: [rent, mortgage] },
                { transactionCount: 3, budgetStreamCount: 0 }
            );

            button(element, 'Delete')!.click();
            await fixture.whenStable();

            expect(financeService.deleteCategory).not.toHaveBeenCalled();
            expect(dialogRef.close).not.toHaveBeenCalled();
        });

        it('CAT-4.4 should stay open when the server refuses the delete', async () => {
            const { element, fixture, financeService, dialogRef, notificationService } = await render({
                category: rent,
                groups
            });
            financeService.deleteCategory.mockResolvedValue(false);

            button(element, 'Delete')!.click();
            await fixture.whenStable();

            expect(notificationService.success).not.toHaveBeenCalled();
            expect(dialogRef.close).not.toHaveBeenCalled();
        });

        it('CAT-4.5 should explain why a category used by a budget stream cannot be deleted', async () => {
            const { element } = await render({ category: rent, groups }, { transactionCount: 4, budgetStreamCount: 2 });

            expect(button(element, 'Delete')!.disabled).toBe(true);
            expect(element.querySelector('.locked-note')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
                'To delete this category, first delete its 2 budget streams or assign them to another category.'
            );
        });
    });
});
