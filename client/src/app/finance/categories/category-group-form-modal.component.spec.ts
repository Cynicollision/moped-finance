import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CategoryType } from '@shared/finance/enum';
import { CategoryGroup } from '@shared/finance/types';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';
import { CategoryGroupFormModalComponent, CategoryGroupFormModalData } from './category-group-form-modal.component';

describe('CategoryGroupFormModalComponent', () => {
    const housing = { id: 'grp-1', name: 'Housing', type: CategoryType.Expense } as CategoryGroup;

    async function render(data: CategoryGroupFormModalData) {
        const financeService = {
            createCategoryGroup: vi.fn().mockResolvedValue({ id: 'grp-2' }),
            saveCategoryGroup: vi.fn().mockResolvedValue(housing),
            deleteCategoryGroup: vi.fn().mockResolvedValue(true)
        };
        const dialogRef = { close: vi.fn() };
        const notificationService = { success: vi.fn() };
        const modalService = { confirm: vi.fn().mockResolvedValue(true), requestClose: vi.fn() };
        TestBed.configureTestingModule({
            imports: [CategoryGroupFormModalComponent],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: data },
                { provide: MatDialogRef, useValue: dialogRef },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: notificationService },
                { provide: ModalService, useValue: modalService }
            ]
        });

        const fixture = TestBed.createComponent(CategoryGroupFormModalComponent);
        await fixture.whenStable();
        return { fixture, element: fixture.nativeElement as HTMLElement, financeService, dialogRef, notificationService };
    }

    function button(element: HTMLElement, label: string): HTMLButtonElement | undefined {
        return Array.from(element.querySelectorAll('button')).find(b => b.textContent!.trim() === label);
    }

    it('CAT-1.6 should create a group from the dialog, with its Save button in the action bar', async () => {
        const { fixture, element, financeService, dialogRef, notificationService } = await render({});

        const save = button(element, 'Save')!;
        expect(save.closest('mat-dialog-actions')).not.toBeNull();
        expect(save.closest('form')).toBeNull();
        expect(button(element, 'Delete')).toBeUndefined();

        fixture.componentInstance.form.setValue({ id: null, name: 'Auto', type: CategoryType.Expense });
        await fixture.whenStable();
        save.click();
        await fixture.whenStable();

        expect(financeService.createCategoryGroup).toHaveBeenCalledWith({ name: 'Auto', type: CategoryType.Expense });
        expect(notificationService.success).toHaveBeenCalledWith('Group created');
        expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('CAT-1.14 should keep a group\'s type when editing it', async () => {
        const { fixture, element, financeService } = await render({ group: housing, categoryCount: 2 });
        const form = fixture.componentInstance.form;

        expect(form.controls.type.disabled).toBe(true);
        expect(element.querySelector('mat-hint')!.textContent!.trim()).toBe('To change it, move the categories to a group of another type.');

        form.patchValue({ name: 'Home' });
        await fixture.componentInstance.save();

        expect(financeService.saveCategoryGroup).toHaveBeenCalledWith({ ...housing, name: 'Home', type: CategoryType.Expense });
    });

    it('CAT-1.15 should delete an empty group from its Edit dialog', async () => {
        const { fixture, element, financeService, notificationService, dialogRef } = await render({ group: housing, categoryCount: 0 });

        button(element, 'Delete')!.click();
        await fixture.whenStable();

        expect(financeService.deleteCategoryGroup).toHaveBeenCalledWith('grp-1');
        expect(notificationService.success).toHaveBeenCalledWith('Group deleted');
        expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('CAT-1.15 should not offer to delete a group that still has categories', async () => {
        const { element } = await render({ group: housing, categoryCount: 1 });

        expect(button(element, 'Delete')!.disabled).toBe(true);
        expect(element.querySelector('.delete-note')!.textContent!.trim()).toBe('To delete this group, first move or delete its 1 category.');
    });
});
