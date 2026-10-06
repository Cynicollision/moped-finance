import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { ConfirmModalComponent, ConfirmModalData } from './confirm-modal.component';

describe('ConfirmModalComponent', () => {
    let dialogRef: { close: ReturnType<typeof vi.fn> };

    function render(data: ConfirmModalData) {
        dialogRef = { close: vi.fn() };
        TestBed.configureTestingModule({
            imports: [ConfirmModalComponent],
            providers: [
                { provide: MatDialogRef, useValue: dialogRef },
                { provide: MAT_DIALOG_DATA, useValue: data }
            ]
        });
        const fixture = TestBed.createComponent(ConfirmModalComponent);
        fixture.detectChanges();
        return fixture.nativeElement as HTMLElement;
    }

    function confirmButton(element: HTMLElement): HTMLButtonElement {
        const buttons = element.querySelectorAll<HTMLButtonElement>('[modal-actions] button');
        return buttons[buttons.length - 1];
    }

    it('APP-2.4 should name the action and show a destructive confirm button in the error color', () => {
        const element = render({
            title: 'Delete Transaction',
            message: 'Are you sure?',
            confirmLabel: 'Delete',
            isWarn: true
        });

        expect(element.textContent).toContain('Delete Transaction');
        expect(confirmButton(element).textContent?.trim()).toBe('Delete');
        expect(confirmButton(element).classList).toContain('danger-button');
    });

    it('APP-2.4 should show an ordinary confirm button when the action is not destructive', () => {
        const element = render({ message: 'Continue?' });

        expect(confirmButton(element).classList).not.toContain('danger-button');
    });

    it('APP-2.4 should close with true on confirm and false on cancel', () => {
        const element = render({ message: 'Continue?' });
        const [cancel, confirm] = Array.from(element.querySelectorAll<HTMLButtonElement>('[modal-actions] button'));

        confirm.click();
        cancel.click();

        expect(dialogRef.close.mock.calls).toEqual([[true], [false]]);
    });
});
