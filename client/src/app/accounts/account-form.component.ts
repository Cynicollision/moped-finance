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
import { AccountType } from '@shared/finance/enum';
import { Account, AccountRequest, Institution } from '@shared/finance/types';
import { AccountTypeUtil } from '@shared/finance/util';
import { DateProviderService } from './../core/date-provider.service';
import { flipForLiability, isLiability } from './account-balance';

/**
 * An account's fields: Add Account's form, with its Starting Balance (ACCT-1.3, 2.2), and Manage Account's Details
 * (ACCT-1.5, 7.2), whose balance is set in the Update balance dialog instead (ACCT-7.5).
 */
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

    /**
     * The Type select's options, under their groups (ACCT-1.2). An account being edited keeps to its own side of Asset
     * or Liability (ACCT-1.13).
     */
    readonly typeGroups = computed(() => {
        const account = this.account();
        if (this.mode() !== 'edit' || !account) {
            return AccountTypeUtil.groups;
        }
        const category = AccountTypeUtil.categoryOf(account.type);
        return AccountTypeUtil.groups.filter(info => info.category === category);
    });

    readonly accountForm = new FormGroup({
        name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        institutionId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        type: new FormControl<AccountType>(AccountType.Checking, {
            nonNullable: true,
            validators: [Validators.required]
        }),
        isHidden: new FormControl<boolean>(false, { nonNullable: true }),
        // The starting balance as the user reads it: a liability's is the amount owed, positive (APP-6.3).
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

    readonly balanceLabel = computed(() => (isLiability(this.type()) ? 'Amount owed' : 'Starting Balance'));

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
            this.reset(account);
        } else {
            this.accountForm.controls.institutionId.setValue(this.defaultInstitutionId() ?? '');
        }
    }

    /** Shows the account's saved fields, dropping any unsaved changes. */
    reset(account: Account) {
        this.accountForm.reset({
            name: account.name,
            institutionId: account.institutionId,
            type: account.type,
            isHidden: account.isHidden ?? false,
            balance: null
        });
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
        // Recorded as of today (ACCT-2.2). A blank starting balance records nothing (ACCT-1.4).
        if (this.mode() === 'create' && balance !== null) {
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
