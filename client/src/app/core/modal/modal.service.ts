import { Injectable, Type, inject } from '@angular/core';
import { MatDialog, MatDialogConfig } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmModalComponent, ConfirmModalData } from './confirm-modal.component';

@Injectable({
    providedIn: 'root'
})
export class ModalService {
    private dialog = inject(MatDialog);

    /**
     * Opens a standard modal with the specified component.
     *
     * @param component The component to render inside the modal
     * @param data Optional data to pass to the component via MAT_DIALOG_DATA
     * @param config Optional MatDialog configuration overrides
     * @returns Promise resolving to the result data when the modal closes
     */
    async open<T, D = unknown, R = unknown>(component: Type<T>, data?: D, config?: MatDialogConfig<D>): Promise<R | undefined> {
        const dialogConfig: MatDialogConfig<D> = {
            width: '500px',
            disableClose: true, // Requires user to explicitly click close or an action
            autoFocus: true,
            data,
            ...config
        };

        const dialogRef = this.dialog.open(component, dialogConfig);
        return firstValueFrom(dialogRef.afterClosed());
    }

    /**
     * Opens a standard confirmation modal.
     *
     * @param data The configuration for the confirmation modal
     * @param config Optional MatDialog configuration overrides
     * @returns Promise resolving to the confirmation boolean
     */
    async confirm(data: ConfirmModalData, config?: MatDialogConfig<ConfirmModalData>): Promise<boolean | undefined> {
        return this.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, data, config);
    }
}
