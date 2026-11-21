import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Account } from '@shared/finance/types';
import { DateProviderService } from './../core/date-provider.service';
import { ModalCancelDirective } from './../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../core/modal/modal-layout.component';
import { NotificationService } from './../core/notification.service';
import { HasUnsavedChanges } from './../core/unsaved-changes';
import { FinanceService } from './../common/finance.service';
import { flipForLiability, isLiability } from './account-balance';

export interface UpdateBalanceDialogData {
    account: Account;
}

/**
 * Sets a manual account's balance as of today (ACCT-2.2, 7.5). Saves itself, staying open if the server refuses, and
 * closes with true once the balance is recorded.
 */
@Component({
    selector: 'app-update-balance-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatProgressSpinnerModule,
        ModalCancelDirective,
        ModalLayoutComponent
    ],
    templateUrl: './update-balance-dialog.component.html',
    styleUrl: './update-balance-dialog.component.scss'
})
export class UpdateBalanceDialogComponent implements HasUnsavedChanges {
    private financeService = inject(FinanceService);
    private notificationService = inject(NotificationService);
    private dateProvider = inject(DateProviderService);
    private dialogRef = inject<MatDialogRef<UpdateBalanceDialogComponent, boolean>>(MatDialogRef);
    readonly account = inject<UpdateBalanceDialogData>(MAT_DIALOG_DATA).account;

    /** A liability's balance is asked for as the amount owed (APP-6.3). */
    readonly label = isLiability(this.account.type) ? 'Amount owed' : 'Balance';
    readonly isSaving = signal(false);
    private saved = false;

    readonly form = new FormGroup({
        // Starts at the current balance, or blank when there's none yet (ACCT-2.2).
        balance: new FormControl<number | null>(
            this.account.balanceDate ? flipForLiability(this.account.type, this.account.balance ?? 0) : null,
            { validators: [Validators.required] }
        )
    });

    hasUnsavedChanges(): boolean {
        return this.form.dirty && !this.saved;
    }

    async save(): Promise<void> {
        const balance = this.form.controls.balance.value;
        if (this.form.invalid || balance === null || this.isSaving()) {
            return;
        }

        this.isSaving.set(true);
        // Only the balance: the account's other fields keep their values (updates are partial).
        const updated = await this.financeService.saveAccount(this.account.id, {
            balanceEntry: { date: this.dateProvider.today(), balance: flipForLiability(this.account.type, balance) }
        });
        this.isSaving.set(false);

        if (updated) {
            this.saved = true;
            this.notificationService.success('Balance updated');
            this.dialogRef.close(true);
        }
    }
}
