import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    OnChanges,
    SimpleChanges,
    computed,
    inject,
    input,
    output
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AccountCategory, AccountType } from '@shared/finance/enum';
import { Account, AccountRequest, Institution } from '@shared/finance/types';
import { AccountTypeUtil } from '@shared/finance/util';
import { DateProviderService } from './../../core/date-provider.service';

function isLiability(type: AccountType): boolean {
    return AccountTypeUtil.categoryOf(type) === AccountCategory.Liability;
}

/**
 * Converts between a stored balance and the amount the form shows, either way: a liability's balance is stored
 * negative and shown as the amount owed (APP-6.3). `|| 0` keeps nothing owed from becoming -0.
 */
function flipForLiability(type: AccountType, amount: number): number {
    return (isLiability(type) ? -amount : amount) || 0;
}

@Component({
    selector: 'app-account-form',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
        MatProgressSpinnerModule
    ],
    templateUrl: './account-form.component.html',
    styleUrl: './account-form.component.scss'
})
export class AccountFormComponent implements OnInit, OnChanges {
    private dateProvider = inject(DateProviderService);

    readonly account = input<Account | null>(null);
    readonly mode = input<'create' | 'edit'>('create');
    /** The institutions to choose from, sorted by name. */
    readonly institutions = input<Institution[]>([]);
    /** The institution a new account starts at, when it's added from that institution. */
    readonly defaultInstitutionId = input<string | null>(null);
    /** While the parent saves: Save is disabled and shows a spinner. */
    readonly saving = input(false);
    readonly save = output<AccountRequest>();
    readonly cancelled = output<void>();

    /** The Type select's options, under their groups (ACCT-1.2). */
    readonly typeGroups = AccountTypeUtil.groups;

    readonly accountForm = new FormGroup({
        name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        institutionId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        type: new FormControl<AccountType>(AccountType.Checking, {
            nonNullable: true,
            validators: [Validators.required]
        }),
        isHidden: new FormControl<boolean>(false, { nonNullable: true }),
        hideFromSpending: new FormControl<boolean>(false, { nonNullable: true }),
        // As of today, as the user reads it: a liability's balance is the amount owed, positive (APP-6.3).
        balance: new FormControl<number | null>(null)
    });

    private readonly type = toSignal(this.accountForm.controls.type.valueChanges, {
        initialValue: this.accountForm.controls.type.value
    });

    /** The group and Asset/Liability that the chosen type decides, shown read-only under it (ACCT-1.2). */
    readonly typeHint = computed(() => {
        const type = this.type();
        return `${AccountTypeUtil.groupOf(type)} · ${AccountTypeUtil.categoryOf(type)}`;
    });

    /** A manual account's balance is set here (ACCT-2.2); a connected one's comes from its bank (ACCT-4.4). */
    readonly showBalance = computed(() => this.mode() === 'create' || (this.account()?.isManual ?? false));

    readonly balanceLabel = computed(() => {
        if (isLiability(this.type())) {
            return 'Amount owed';
        }
        return this.mode() === 'create' ? 'Starting Balance' : 'Balance';
    });

    ngOnInit() {
        this.updateFormState();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['account'] || changes['defaultInstitutionId']) {
            this.updateFormState();
        }
    }

    private updateFormState() {
        const account = this.account();
        if (account) {
            this.accountForm.patchValue({
                name: account.name,
                institutionId: account.institutionId,
                type: account.type,
                isHidden: account.isHidden,
                hideFromSpending: account.hideFromSpending,
                // Blank when there's no balance yet, as on Add Account.
                balance: account.balanceDate ? flipForLiability(account.type, account.balance ?? 0) : null
            });
        } else {
            this.accountForm.controls.institutionId.setValue(this.defaultInstitutionId() ?? '');
        }
    }

    hasUnsavedChanges(): boolean {
        return this.accountForm.dirty;
    }

    onSubmit() {
        if (!this.accountForm.valid) {
            return;
        }

        const { balance, ...fields } = this.accountForm.getRawValue();
        const request: AccountRequest = fields;
        // Recorded as of today (ACCT-2.2). A blank starting balance records nothing (ACCT-1.4); on Edit Account, only
        // a changed balance does.
        const balanceChanged = this.mode() === 'create' || this.accountForm.controls.balance.dirty;
        if (this.showBalance() && balance !== null && balanceChanged) {
            request.balanceEntry = {
                date: this.dateProvider.today(),
                balance: flipForLiability(fields.type, balance)
            };
        }
        this.save.emit(request);
    }

    onCancelClick() {
        this.cancelled.emit();
    }
}
