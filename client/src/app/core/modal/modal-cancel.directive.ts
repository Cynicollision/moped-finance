import { Directive, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { ModalService } from './modal.service';

/**
 * Put on a dialog's Cancel button in place of `mat-dialog-close`: it closes the dialog the same way Esc does,
 * asking first if the dialog has unsaved changes (APP-2.7).
 */
@Directive({
    selector: '[appModalCancel]',
    host: {
        '(click)': 'cancel()'
    }
})
export class ModalCancelDirective {
    private dialogRef = inject(MatDialogRef);
    private modalService = inject(ModalService);

    cancel(): void {
        this.modalService.requestClose(this.dialogRef);
    }
}
