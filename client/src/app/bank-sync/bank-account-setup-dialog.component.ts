import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { CalendarDateUtil } from '@shared/core/util';
import { BankAccountRequest, BankAccountResult } from '@shared/finance/contracts';
import { AccountType, BankAccountAction } from '@shared/finance/enum';
import { Account, BankAccount, Institution } from '@shared/finance/types';
import { AccountTypeUtil } from '@shared/finance/util';
import { MoneyComponent } from './../common/money.component';
import { FinanceService } from './../common/finance.service';
import { CardSkeletonComponent } from './../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { viewResource } from './../core/loading/view-resource';
import { ModalCancelDirective } from './../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../core/modal/modal-layout.component';
import { NotificationService } from './../core/notification.service';
import { HasUnsavedChanges } from './../core/unsaved-changes';
import { BankSyncService } from './bank-sync.service';
import { describeLinked } from './bank-sync-wording';

/** What setting up a bank account can do (SYNC-2.2 to 2.4). */
export type BankAccountSetupChoice = BankAccountAction.Link | BankAccountAction.Create | BankAccountAction.Ignore;

export interface BankAccountSetupDialogData {
    bankAccount: BankAccount;
    /** Opens on this choice without offering the others (a row's ⋮ menu); without it, the user chooses (Set up). */
    choice?: BankAccountAction.Link | BankAccountAction.Create;
}

/** The Institution select's value for a new institution named after the connection (SYNC-2.3). */
const newInstitution = 'new';

const titles: Record<BankAccountSetupChoice, string> = {
    [BankAccountAction.Link]: 'Link to an Account',
    [BankAccountAction.Create]: 'Create New Account',
    [BankAccountAction.Ignore]: "Don't Sync"
};

const actionLabels: Record<BankAccountSetupChoice, string> = {
    [BankAccountAction.Link]: 'Link',
    [BankAccountAction.Create]: 'Create Account',
    [BankAccountAction.Ignore]: "Don't Sync"
};

/**
 * Sets up one bank account from Bank Sync (SYNC-2.1): Link to an account (SYNC-2.4), Create new account (SYNC-2.3) or
 * Don't sync (SYNC-2.2). Saves itself, staying open if the server refuses, and closes with true once it's done.
 */
@Component({
    selector: 'app-bank-account-setup-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatCheckboxModule,
        MatDatepickerModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        MatNativeDateModule,
        MatProgressSpinnerModule,
        MatRadioModule,
        MatSelectModule,
        MoneyComponent,
        CardSkeletonComponent,
        LoadErrorComponent,
        ModalCancelDirective,
        ModalLayoutComponent
    ],
    templateUrl: './bank-account-setup-dialog.component.html',
    styleUrl: './bank-account-setup-dialog.component.scss'
})
export class BankAccountSetupDialogComponent implements HasUnsavedChanges {
    private bankSyncService = inject(BankSyncService);
    private financeService = inject(FinanceService);
    private notificationService = inject(NotificationService);
    private dialogRef = inject<MatDialogRef<BankAccountSetupDialogComponent, boolean>>(MatDialogRef);
    private readonly dialogData = inject<BankAccountSetupDialogData>(MAT_DIALOG_DATA);

    readonly bankAccount = this.dialogData.bankAccount;
    /** Whether the user chooses what to do, rather than the ⋮ menu having chosen. */
    readonly offersChoice = this.dialogData.choice === undefined;
    readonly BankAccountAction = BankAccountAction;
    readonly typeGroups = AccountTypeUtil.groups;
    readonly newInstitution = newInstitution;

    readonly isSaving = signal(false);
    /** Sync transactions from's default is being fetched for the chosen account. */
    readonly loadingSyncFrom = signal(false);
    private saved = false;

    readonly choice = new FormControl<BankAccountSetupChoice>(this.dialogData.choice ?? BankAccountAction.Link, {
        nonNullable: true
    });
    readonly chosen = toSignal(this.choice.valueChanges, { initialValue: this.choice.value });

    readonly linkForm = new FormGroup({
        accountId: new FormControl<string | null>(null, { validators: [Validators.required] }),
        syncFrom: new FormControl<Date | null>(null, { validators: [Validators.required] })
    });

    readonly createForm = new FormGroup({
        name: new FormControl(this.bankAccount.name.slice(0, 100), {
            nonNullable: true,
            validators: [Validators.required, Validators.maxLength(100)]
        }),
        // No default: SimpleFIN doesn't say what kind of account it is (SYNC-2.3).
        type: new FormControl<AccountType | null>(null, { validators: [Validators.required] }),
        institutionId: new FormControl<string>(newInstitution, { nonNullable: true }),
        isHidden: new FormControl(false, { nonNullable: true })
    });

    /** The whole form, for the `<form>` element; each choice checks only its own group. */
    readonly form = new FormGroup({ choice: this.choice, link: this.linkForm, create: this.createForm });

    readonly options = viewResource({
        loader: async () => {
            const [accounts, institutions] = await Promise.all([
                this.financeService.fetchAllAccounts(),
                this.financeService.fetchInstitutions()
            ]);
            return { accounts, institutions };
        }
    });

    /** SYNC-2.4: open accounts that aren't linked to another bank account, at any institution, by name. */
    readonly linkableAccounts = computed<Account[]>(() =>
        (this.options.value()?.accounts ?? [])
            .filter(account => account.isManual && !account.closedOn)
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    );

    readonly institutions = computed<Institution[]>(() =>
        [...(this.options.value()?.institutions ?? [])].sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        )
    );

    /** The institution named like the connection, ignoring case (SYNC-2.3); without one, a new one is offered. */
    readonly matchingInstitution = computed(() => {
        const name = this.bankAccount.connectionName.toLocaleLowerCase();
        return this.institutions().find(i => i.name.toLocaleLowerCase() === name);
    });

    private readonly institutionNames = computed(
        () => new Map((this.options.value()?.institutions ?? []).map(i => [i.id, i.name]))
    );

    readonly title = computed(() => (this.offersChoice ? 'Set Up Bank Account' : titles[this.chosen()]));
    readonly actionLabel = computed(() => actionLabels[this.chosen()]);

    private readonly linkStatus = toSignal(this.linkForm.statusChanges, { initialValue: this.linkForm.status });
    private readonly createStatus = toSignal(this.createForm.statusChanges, { initialValue: this.createForm.status });

    readonly canSave = computed(() => {
        // Reads the forms' status through signals so the button follows them.
        this.linkStatus();
        this.createStatus();
        if (this.isSaving() || this.loadingSyncFrom()) {
            return false;
        }
        switch (this.chosen()) {
            case BankAccountAction.Link:
                return this.linkForm.valid;
            case BankAccountAction.Create:
                return this.createForm.valid && this.options.value() !== undefined;
            default:
                return true;
        }
    });

    constructor() {
        this.linkForm.controls.accountId.valueChanges.subscribe(accountId => this.suggestSyncFrom(accountId));
        // Once the institutions load, Institution defaults to the one named like the connection, if there is one.
        effect(() => {
            const match = this.matchingInstitution();
            untracked(() => {
                const control = this.createForm.controls.institutionId;
                if (match && !control.dirty) {
                    control.setValue(match.id);
                }
            });
        });
    }

    /** The chosen account's name alone, without the institution its option shows. */
    accountName(id: string | null): string {
        return this.linkableAccounts().find(a => a.id === id)?.name ?? '';
    }

    institutionName(id: string): string {
        return this.institutionNames().get(id) ?? '';
    }

    hasUnsavedChanges(): boolean {
        return !this.saved && this.form.dirty;
    }

    async save(): Promise<void> {
        const request = this.request();
        if (!request || !this.canSave()) {
            return;
        }

        this.isSaving.set(true);
        const result = await this.bankSyncService.updateBankAccount(this.bankAccount.id, request);
        this.isSaving.set(false);

        if (result) {
            this.saved = true;
            this.notificationService.success(this.describe(result));
            this.dialogRef.close(true);
        }
    }

    private request(): BankAccountRequest | undefined {
        switch (this.chosen()) {
            case BankAccountAction.Link: {
                const { accountId, syncFrom } = this.linkForm.getRawValue();
                if (!accountId || !syncFrom) {
                    return undefined;
                }
                return { action: BankAccountAction.Link, accountId, syncFrom: CalendarDateUtil.fromDate(syncFrom) };
            }
            case BankAccountAction.Create: {
                const { name, type, institutionId, isHidden } = this.createForm.getRawValue();
                if (!type) {
                    return undefined;
                }
                const institution =
                    institutionId === newInstitution
                        ? { institutionName: this.bankAccount.connectionName }
                        : { institutionId };
                return { action: BankAccountAction.Create, name: name.trim(), type, isHidden, ...institution };
            }
            default:
                return { action: BankAccountAction.Ignore };
        }
    }

    private describe(result: BankAccountResult): string {
        switch (this.chosen()) {
            case BankAccountAction.Link:
                return describeLinked('Bank account linked', result.transactionsAdded);
            case BankAccountAction.Create:
                return describeLinked('Account created', result.transactionsAdded);
            default:
                return "Bank account set to Don't sync";
        }
    }

    /** Sync transactions from follows the chosen account (SYNC-2.4); the user can change it afterwards. */
    private async suggestSyncFrom(accountId: string | null): Promise<void> {
        const control = this.linkForm.controls.syncFrom;
        if (!accountId) {
            control.setValue(null);
            return;
        }
        this.loadingSyncFrom.set(true);
        const syncFrom = await this.bankSyncService.fetchSyncFromDefault(this.bankAccount.id, accountId);
        this.loadingSyncFrom.set(false);
        // Ignore an answer for an account that's no longer chosen.
        if (syncFrom && this.linkForm.controls.accountId.value === accountId) {
            control.setValue(CalendarDateUtil.toDate(syncFrom));
        }
    }
}
