import { Injectable, Type, inject } from '@angular/core';
import { MatDialog, MatDialogConfig, MatDialogRef } from '@angular/material/dialog';
import { filter, firstValueFrom, merge } from 'rxjs';
import { LayoutService } from './../layout/layout.service';
import { hasUnsavedChanges } from './../unsaved-changes';
import { ConfirmModalComponent, ConfirmModalData } from './confirm-modal.component';

export interface ModalOptions {
    /**
     * `form` (the default) fills the screen on phones (APP-2.6); `small`, for confirmations, never does. `panel`
     * fills the screen on phones too, and on larger screens is a side panel down the right edge, leaving the
     * screen it edits in view.
     */
    size?: 'form' | 'small' | 'panel';
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
    async open<T, D = unknown, R = unknown>(
        component: Type<T>,
        data?: D,
        options: ModalOptions = {}
    ): Promise<R | undefined> {
        const size = options.size ?? 'form';
        const config: MatDialogConfig<D> = {
            data,
            // The first field, or the dialog itself when it has none (a confirmation).
            autoFocus: 'input:not([readonly])',
            // Closing goes through requestClose, so unsaved changes can be kept.
            disableClose: true,
            ...this.sizeConfig(size)
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

    private sizeConfig(size: ModalOptions['size']): MatDialogConfig {
        if (size !== 'small' && this.layout.isCompact()) {
            return {
                width: '100vw',
                maxWidth: '100vw',
                height: '100%',
                maxHeight: '100%',
                panelClass: 'full-screen-dialog'
            };
        }
        if (size === 'panel') {
            return {
                width: '400px',
                maxWidth: '100vw',
                height: '100%',
                maxHeight: '100%',
                position: { top: '0', right: '0' },
                panelClass: 'side-panel-dialog'
            };
        }
        return { width: size === 'small' ? '400px' : '560px', maxWidth: 'calc(100vw - 32px)' };
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
            if (!hasUnsavedChanges(dialogRef.componentInstance) || (await this.confirmDiscard())) {
                dialogRef.close();
            }
        } finally {
            this.closing.delete(dialogRef);
        }
    }

    /** Asks whether to leave a form with unsaved changes (APP-2.7). */
    async confirmDiscard(): Promise<boolean> {
        const confirmed = await this.confirm({
            title: 'Discard changes?',
            message: "Your changes haven't been saved.",
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
        return this.open<ConfirmModalComponent, ConfirmModalData, boolean>(ConfirmModalComponent, data, {
            size: 'small'
        });
    }
}
