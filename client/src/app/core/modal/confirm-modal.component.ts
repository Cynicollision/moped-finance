import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ModalLayoutComponent } from './modal-layout.component';

export interface ConfirmModalData {
    title?: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isWarn?: boolean;
}

@Component({
    selector: 'app-confirm-modal',
    standalone: true,
    imports: [MatDialogModule, MatButtonModule, ModalLayoutComponent],
    templateUrl: './confirm-modal.component.html',
    styleUrl: './confirm-modal.component.scss'
})
export class ConfirmModalComponent {
    constructor(
        public dialogRef: MatDialogRef<ConfirmModalComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ConfirmModalData
    ) { }

    onCancel(): void {
        this.dialogRef.close(false);
    }

    onConfirm(): void {
        this.dialogRef.close(true);
    }
}
