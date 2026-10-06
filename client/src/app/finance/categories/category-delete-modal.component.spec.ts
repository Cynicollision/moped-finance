import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CategoryType } from '@shared/finance/enum';
import { Category, CategoryGroup } from '@shared/finance/types';
import { ModalService } from './../../core/modal/modal.service';
import { CategoryDeleteModalComponent, CategoryDeleteModalData } from './category-delete-modal.component';

describe('CategoryDeleteModalComponent', () => {
    const groups = [
        { id: 'housing', name: 'Housing', type: CategoryType.Expense },
        { id: 'work', name: 'Work', type: CategoryType.Income },
        { id: 'empty', name: 'Empty', type: CategoryType.Expense }
    ] as CategoryGroup[];

    function category(id: string, name: string, groupId: string, isActive = true, icon = ''): Category {
        return { id, name, groupId, isActive, icon, necessity: null } as Category;
    }

    const rent = category('rent', 'Rent', 'housing', true, '🏠');
    const categories = [
        rent,
        category('utilities', 'Utilities', 'housing'),
        category('mortgage', 'Mortgage', 'housing', true, '🏦'),
        category('old', 'Old Rent', 'housing', false),
        category('paycheck', 'Paycheck', 'work')
    ];

    async function render(data: Partial<CategoryDeleteModalData> = {}) {
        const dialogRef = { close: vi.fn() };
        TestBed.configureTestingModule({
            imports: [CategoryDeleteModalComponent],
            providers: [
                {
                    provide: MAT_DIALOG_DATA,
                    useValue: { category: rent, transactionCount: 12, groups, categories, ...data }
                },
                { provide: MatDialogRef, useValue: dialogRef },
                { provide: ModalService, useValue: { requestClose: vi.fn() } }
            ]
        });

        const fixture = TestBed.createComponent(CategoryDeleteModalComponent);
        await fixture.whenStable();
        return { fixture, element: fixture.nativeElement as HTMLElement, dialogRef };
    }

    function deleteButton(element: HTMLElement): HTMLButtonElement {
        return Array.from(element.querySelectorAll('button')).find(b => b.textContent!.trim() === 'Delete')!;
    }

    it('CAT-4.4 should say how many transactions use the category', async () => {
        const { element } = await render();

        expect(element.querySelector('.delete-message')!.textContent!.trim()).toBe(
            "12 transactions use 🏠 Rent. Choose a category to move them to. This can't be undone."
        );
    });

    it('CAT-4.4 should say it for a single transaction', async () => {
        const { element } = await render({ transactionCount: 1 });

        expect(element.querySelector('.delete-message')!.textContent!.trim()).toBe(
            "1 transaction uses 🏠 Rent. Choose a category to move it to. This can't be undone."
        );
    });

    it('CAT-4.4 should offer Uncategorized, then the other active categories under their groups', async () => {
        const { fixture, element } = await render();

        (element.querySelector('.mat-mdc-select-trigger') as HTMLElement).click();
        await fixture.whenStable();

        const groupLabels = Array.from(document.querySelectorAll('mat-optgroup')).map(g =>
            g.querySelector('.mat-mdc-optgroup-label')!.textContent!.trim()
        );
        expect(groupLabels).toEqual(['Work (Income)', 'Housing (Expense)']);
        const options = Array.from(document.querySelectorAll('mat-option')).map(o => o.textContent!.trim());
        expect(options).toEqual(['Uncategorized', 'Paycheck', '🏦 Mortgage', 'Utilities']);
    });

    it('CAT-4.4 should move the transactions to Uncategorized by default', async () => {
        const { fixture, element, dialogRef } = await render();

        deleteButton(element).click();
        await fixture.whenStable();

        expect(dialogRef.close).toHaveBeenCalledWith({ moveToId: '' });
    });

    it('CAT-4.4 should close with the chosen category', async () => {
        const { fixture, element, dialogRef } = await render();

        fixture.componentInstance.form.setValue({ moveTo: 'mortgage' });
        deleteButton(element).click();
        await fixture.whenStable();

        expect(dialogRef.close).toHaveBeenCalledWith({ moveToId: 'mortgage' });
    });
});
