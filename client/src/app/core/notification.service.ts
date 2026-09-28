import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';
import { LayoutService } from './layout/layout.service';

/**
 * Short messages at the bottom of the screen (APP-2.2, APP-2.8): centred on phones, above the bottom
 * navigation when it's showing, and at the bottom right on larger screens.
 */
@Injectable({
    providedIn: 'root'
})
export class NotificationService {
    private snackBar = inject(MatSnackBar);
    private layout = inject(LayoutService);

    /** A create, save, delete or import that worked, for example "Account saved". */
    success(message: string): void {
        this.snackBar.open(message, undefined, this.config(4000));
    }

    /** A request that failed. Stays a little longer, with a Close button. */
    error(message: string): void {
        this.snackBar.open(message, 'Close', this.config(5000, 'snackbar-error'));
    }

    private config(duration: number, panelClass?: string): MatSnackBarConfig {
        const compact = this.layout.isCompact();
        const classes = panelClass ? [panelClass] : [];
        if (compact && this.layout.hasBottomNav()) {
            classes.push('snackbar-above-bottom-nav');
        }
        return {
            duration,
            horizontalPosition: compact ? 'center' : 'end',
            verticalPosition: 'bottom',
            panelClass: classes
        };
    }
}
