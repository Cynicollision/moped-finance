import { Injectable, Type } from '@angular/core';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';

@Injectable({
    providedIn: 'root'
})
export class ModalService {
    constructor(private dialog: MatDialog) { }

    /**
     * Opens a standard modal with the specified component.
     *
     * @param component The component to render inside the modal
     * @param data Optional data to pass to the component via MAT_DIALOG_DATA
     * @param config Optional MatDialog configuration overrides
     * @returns MatDialogRef that can be used to close the modal and receive result data
     */
    open<T, D = any, R = any>(
        component: Type<T>,
        data?: D,
        config?: MatDialogConfig<D>
    ): MatDialogRef<T, R> {
        const dialogConfig: MatDialogConfig<D> = {
            width: '500px',
            disableClose: true, // Requires user to explicitly click close or an action
            autoFocus: true,
            data,
            ...config
        };

        return this.dialog.open(component, dialogConfig);
    }
}
