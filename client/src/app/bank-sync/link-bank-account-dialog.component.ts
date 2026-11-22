import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { CalendarDateUtil } from '@shared/core/util';
import { BankAccountAction } from '@shared/finance/enum';
import { Account, BankAccount } from '@shared/finance/types';
import { MoneyComponent } from './../common/money.component';
import { ModalCancelDirective } from './../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../core/modal/modal-layout.component';
import { NotificationService } from './../core/notification.service';
import { HasUnsavedChanges } from './../core/unsaved-changes';
import { BankSyncService } from './bank-sync.service';
import { describeLinked } from './bank-sync-wording';

export interface LinkBankAccountDialogData {
    account: Account;
    /** The bank accounts it can link to: in US dollars and not linked to another account (ACCT-7.3, SYNC-2.4). */
    bankAccounts: BankAccount[];
}

/** One connection's bank accounts, for the select's groups. */
interface ConnectionOptions {
    id: string;
    name: string;
    bankAccounts: BankAccount[];
}

/**
 * Manage Account's Link to bank account (ACCT-7.3): the bank account and Sync transactions from (SYNC-2.4). Saves
 * itself, staying open if the server refuses, and closes with true once the account is linked.
 */
@Component({
    selector: 'app-link-bank-account-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatDatepickerModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatNativeDateModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        MoneyComponent,
        ModalCancelDirective,
        ModalLayoutComponent
    ],
    templateUrl: './link-bank-account-dialog.component.html',
    styleUrl: './link-bank-account-dialog.component.scss'
})
export class LinkBankAccountDialogComponent implements HasUnsavedChanges {
    private bankSyncService = inject(BankSyncService);
    private notificationService = inject(NotificationService);
    private dialogRef = inject<MatDialogRef<LinkBankAccountDialogComponent, boolean>>(MatDialogRef);
    private readonly dialogData = inject<LinkBankAccountDialogData>(MAT_DIALOG_DATA);

    readonly account = this.dialogData.account;
    readonly isSaving = signal(false);
    /** Sync transactions from's default is being fetched for the chosen bank account. */
    readonly loadingSyncFrom = signal(false);
    private saved = false;

    readonly form = new FormGroup({
        bankAccountId: new FormControl<string | null>(null, { validators: [Validators.required] }),
        syncFrom: new FormControl<Date | null>(null, { validators: [Validators.required] })
    });
    private readonly formStatus = toSignal(this.form.statusChanges, { initialValue: this.form.status });

    /** By connection, then name, as Bank Sync lists them. */
    readonly connections: ConnectionOptions[] = groupByConnection(this.dialogData.bankAccounts);

    readonly canSave = computed(() => this.formStatus() === 'VALID' && !this.isSaving() && !this.loadingSyncFrom());

    constructor() {
        this.form.controls.bankAccountId.valueChanges.subscribe(id => this.suggestSyncFrom(id));
    }

    /** The chosen bank account's name alone, without the balance its option shows. */
    bankAccountName(id: string | null): string {
        return this.dialogData.bankAccounts.find(b => b.id === id)?.name ?? '';
    }

    hasUnsavedChanges(): boolean {
        return this.form.dirty && !this.saved;
    }

    async save(): Promise<void> {
        const { bankAccountId, syncFrom } = this.form.getRawValue();
        if (!bankAccountId || !syncFrom || !this.canSave()) {
            return;
        }

        this.isSaving.set(true);
        const result = await this.bankSyncService.updateBankAccount(bankAccountId, {
            action: BankAccountAction.Link,
            accountId: this.account.id,
            syncFrom: CalendarDateUtil.fromDate(syncFrom)
        });
        this.isSaving.set(false);

        if (result) {
            this.saved = true;
            this.notificationService.success(describeLinked('Account linked', result.transactionsAdded));
            this.dialogRef.close(true);
        }
    }

    /** Sync transactions from follows the chosen bank account (SYNC-2.4); the user can change it afterwards. */
    private async suggestSyncFrom(bankAccountId: string | null): Promise<void> {
        const control = this.form.controls.syncFrom;
        if (!bankAccountId) {
            control.setValue(null);
            return;
        }
        this.loadingSyncFrom.set(true);
        const syncFrom = await this.bankSyncService.fetchSyncFromDefault(bankAccountId, this.account.id);
        this.loadingSyncFrom.set(false);
        // Ignore an answer for a bank account that's no longer chosen.
        if (syncFrom && this.form.controls.bankAccountId.value === bankAccountId) {
            control.setValue(CalendarDateUtil.toDate(syncFrom));
        }
    }
}

function groupByConnection(bankAccounts: BankAccount[]): ConnectionOptions[] {
    const groups = new Map<string, ConnectionOptions>();
    for (const bankAccount of bankAccounts) {
        let group = groups.get(bankAccount.connectionId);
        if (!group) {
            group = { id: bankAccount.connectionId, name: bankAccount.connectionName, bankAccounts: [] };
            groups.set(bankAccount.connectionId, group);
        }
        group.bankAccounts.push(bankAccount);
    }
    return [...groups.values()];
}
