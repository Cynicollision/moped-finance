import { Injectable, Type, inject } from '@angular/core';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { filter, firstValueFrom, merge } from 'rxjs';
import { LayoutService } from './../layout/layout.service';
import { hasUnsavedChanges } from './../unsaved-changes';
import { ConfirmModalComponent, ConfirmModalData } from './confirm-modal.component';

export interface ModalOptions {
    /** `form` (the default) fills the screen on phones (APP-2.6); `small`, for confirmations, never does. */
    size?: 'form' | 'small';
}

@Injectable({
    providedIn: 'root'
})
export class ModalService {
    private dialog = inject(MatDialog);
    private layout = inject(LayoutService);
    private closing = new WeakSet<MatDialogRef<unknown>>();

    /**
     * Opens a dialog with the given component, which receives `data` as MAT_DIALOG_DATA. Esc, a click outside
     * and the close button close it, asking first when the component has unsaved changes (APP-2.7).
     *
     * @returns the result the dialog closed with, or undefined if it was dismissed
     */
    async open<T, D = unknown, R = unknown>(component: Type<T>, data?: D, options: ModalOptions = {}): Promise<R | undefined> {
        const small = options.size === 'small';
        const fullScreen = !small && this.layout.isCompact();
        const config: MatDialogConfig<D> = {
            data,
            // The first field, or the dialog itself when it has none (a confirmation).
            autoFocus: 'input:not([readonly])',
            // Closing goes through requestClose, so unsaved changes can be kept.
            disableClose: true,
            ...(fullScreen
                ? { width: '100vw', maxWidth: '100vw', height: '100%', maxHeight: '100%', panelClass: 'full-screen-dialog' }
                : { width: small ? '400px' : '560px', maxWidth: 'calc(100vw - 32px)' })
        };

        const dialogRef = this.dialog.open<T, D, R>(component, config);
        const dismissals = merge(
            dialogRef.backdropClick(),
            dialogRef.keydownEvents().pipe(filter(event => event.key === 'Escape'))
        ).subscribe(() => this.requestClose(dialogRef));

        const result = await firstValueFrom(dialogRef.afterClosed());
        dismissals.unsubscribe();
        return result;
    }

    /**
     * Closes a dialog without a result, as Cancel, Esc or a click outside do, unless it has unsaved changes and
     * the user chooses to keep editing.
     */
    async requestClose(dialogRef: MatDialogRef<unknown>): Promise<void> {
        if (this.closing.has(dialogRef)) {
            return;
        }
        this.closing.add(dialogRef);
        try {
            if (!hasUnsavedChanges(dialogRef.componentInstance) || await this.confirmDiscard()) {
                dialogRef.close();
            }
        }
        finally {
            this.closing.delete(dialogRef);
        }
    }

    /** Asks whether to leave a form with unsaved changes (APP-2.7). */
    async confirmDiscard(): Promise<boolean> {
        const confirmed = await this.confirm({
            title: 'Discard changes?',
            message: 'Your changes haven\'t been saved.',
            confirmLabel: 'Discard',
            cancelLabel: 'Keep editing',
            isWarn: true
        });
        return confirmed === true;
    }

    /**
     * Opens a confirmation dialog.
     *
     * @returns true if the user confirmed
     */
    async confirm(data: ConfirmModalData): Promise<boolean | undefined> {
        return this.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, data, { size: 'small' });
    }
}
