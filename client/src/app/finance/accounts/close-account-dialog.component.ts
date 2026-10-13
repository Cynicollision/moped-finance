import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CalendarDateUtil } from '@shared/core/util';
import { Account } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { ModalCancelDirective } from './../../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../../core/modal/modal-layout.component';
import { NotificationService } from './../../core/notification.service';
import { HasUnsavedChanges } from './../../core/unsaved-changes';
import { FinanceService } from './../finance.service';

export interface CloseAccountDialogData {
    account: Account;
}

/**
 * Closes an account on a chosen date (ACCT-6.1). Saves itself, staying open if the server refuses, and closes with
 * true once the account is closed.
 */
@Component({
    selector: 'app-close-account-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        ReactiveFormsModule,
        MatButtonModule,
        MatDatepickerModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatNativeDateModule,
        MatProgressSpinnerModule,
        ModalCancelDirective,
        ModalLayoutComponent
    ],
    templateUrl: './close-account-dialog.component.html',
    styleUrl: './close-account-dialog.component.scss'
})
export class CloseAccountDialogComponent implements HasUnsavedChanges {
    private financeService = inject(FinanceService);
    private notificationService = inject(NotificationService);
    private dateProvider = inject(DateProviderService);
    private dialogRef = inject<MatDialogRef<CloseAccountDialogComponent, boolean>>(MatDialogRef);
    readonly account = inject<CloseAccountDialogData>(MAT_DIALOG_DATA).account;

    /** An account can't close after today (APP-8.1). */
    readonly latestDate = this.dateProvider.now();
    readonly isSaving = signal(false);
    private saved = false;

    readonly form = new FormGroup({
        closedOn: new FormControl<Date>(this.dateProvider.now(), {
            nonNullable: true,
            validators: [Validators.required]
        })
    });

    private readonly closedOn = toSignal(this.form.controls.closedOn.valueChanges, {
        initialValue: this.form.controls.closedOn.value
    });

    /** Whether closing removes balance entries after the date: the latest is later than it (ACCT-6.1). */
    readonly removesLaterEntries = computed(() => {
        const closedOn = this.closedOn();
        const latest = this.account.balanceDate;
        return !!closedOn && !!latest && CalendarDateUtil.fromDate(closedOn) < latest;
    });

    hasUnsavedChanges(): boolean {
        return this.form.dirty && !this.saved;
    }

    async close(): Promise<void> {
        if (this.form.invalid || this.isSaving()) {
            return;
        }

        this.isSaving.set(true);
        const closedOn = CalendarDateUtil.fromDate(this.form.controls.closedOn.value);
        const closed = await this.financeService.closeAccount(this.account.id, closedOn);
        this.isSaving.set(false);

        if (closed) {
            this.saved = true;
            this.notificationService.success('Account closed');
            this.dialogRef.close(true);
        }
    }
}
