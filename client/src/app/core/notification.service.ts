import { Injectable, inject } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private _snackBar = inject(MatSnackBar);

  private _defaultConfig: MatSnackBarConfig = {
    duration: 3000,
    horizontalPosition: 'end',
    verticalPosition: 'top',
  };

  success(message: string): void {
    this._snackBar.open(message, 'Close', {
      ...this._defaultConfig,
      panelClass: ['snackbar-success']
    });
  }

  warning(message: string): void {
    this._snackBar.open(message, 'Close', {
      ...this._defaultConfig,
      panelClass: ['snackbar-warning']
    });
  }

  error(message: string): void {
    this._snackBar.open(message, 'Close', {
      ...this._defaultConfig,
      duration: 5000,
      panelClass: ['snackbar-error']
    });
  }
}