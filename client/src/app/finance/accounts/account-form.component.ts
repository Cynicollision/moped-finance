import {
    ChangeDetectionStrategy,
    Component,
    OnInit,
    OnChanges,
    SimpleChanges,
    input,
    output,
    signal
} from '@angular/core';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Account, Institution } from '@shared/finance/types';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';

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
    readonly account = input<Account | null>(null);
    readonly mode = input<'create' | 'edit'>('create');
    /** The institutions to choose from, sorted by name. */
    readonly institutions = input<Institution[]>([]);
    /** The institution a new account starts at, when it's added from that institution. */
    readonly defaultInstitutionId = input<string | null>(null);
    /** While the parent saves: Save is disabled and shows a spinner. */
    readonly saving = input(false);
    readonly save = output<Partial<Account>>();
    readonly cancelled = output<void>();

    readonly categories = Object.values(AccountCategory);
    readonly groups = signal<AccountGroup[]>([]);
    readonly types = signal<AccountType[]>([]);

    readonly accountForm = new FormGroup({
        name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        institutionId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        category: new FormControl<AccountCategory>(AccountCategory.Asset, {
            nonNullable: true,
            validators: [Validators.required]
        }),
        group: new FormControl<AccountGroup | null>(AccountGroup.Cash, { validators: [Validators.required] }),
        // Null for groups that have no account types (credit cards).
        type: new FormControl<AccountType | null>(AccountType.Checking),
        isHidden: new FormControl<boolean>(false, { nonNullable: true }),
        isRetirement: new FormControl<boolean>(false, { nonNullable: true }),
        hideFromSpending: new FormControl<boolean>(false, { nonNullable: true })
    });

    constructor() {
        this.setupSubscriptions();
    }

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
            this.updateAvailableGroups(account.category);
            this.updateAvailableTypes(account.group);

            this.accountForm.patchValue(
                {
                    name: account.name,
                    institutionId: account.institutionId,
                    category: account.category,
                    group: account.group,
                    type: account.type,
                    isHidden: account.isHidden,
                    isRetirement: account.isRetirement,
                    hideFromSpending: account.hideFromSpending
                },
                { emitEvent: false }
            );
        } else {
            this.updateAvailableGroups(AccountCategory.Asset);
            this.updateAvailableTypes(AccountGroup.Cash);
            this.accountForm.controls.institutionId.setValue(this.defaultInstitutionId() ?? '', { emitEvent: false });
        }
    }

    private setupSubscriptions() {
        this.accountForm.controls.category.valueChanges.subscribe(category => {
            this.updateAvailableGroups(category);
            const groups = this.groups();
            const group = this.accountForm.controls.group.value;
            if (groups.length === 0) {
                this.accountForm.controls.group.setValue(null);
            } else if (!group || !groups.includes(group)) {
                this.accountForm.controls.group.setValue(groups[0]);
            }
        });

        this.accountForm.controls.group.valueChanges.subscribe(group => {
            this.updateAvailableTypes(group);
            const types = this.types();
            const type = this.accountForm.controls.type.value;
            if (types.length === 0) {
                this.accountForm.controls.type.setValue(null);
            } else if (!type || !types.includes(type)) {
                this.accountForm.controls.type.setValue(types[0]);
            }
        });
    }

    private updateAvailableGroups(category: AccountCategory) {
        if (category === AccountCategory.Asset) {
            this.groups.set([AccountGroup.Cash, AccountGroup.Investment, AccountGroup.RealEstate]);
        } else if (category === AccountCategory.Liability) {
            this.groups.set([AccountGroup.CreditCard, AccountGroup.Loan]);
        } else {
            this.groups.set([]);
        }
    }

    private updateAvailableTypes(group: AccountGroup | null) {
        this.types.set(this.typesForGroup(group));
    }

    private typesForGroup(group: AccountGroup | null): AccountType[] {
        switch (group) {
            case AccountGroup.Cash:
                return [AccountType.Checking, AccountType.Savings];
            case AccountGroup.Investment:
                return [
                    AccountType.Retirement_401k,
                    AccountType.Retirement_IRA,
                    AccountType.Brokerage,
                    AccountType.HSA
                ];
            case AccountGroup.RealEstate:
                return [AccountType.PrimaryResidence];
            case AccountGroup.Loan:
                return [AccountType.Mortgage];
            case AccountGroup.CreditCard:
                return [];
            default:
                return [];
        }
    }

    hasUnsavedChanges(): boolean {
        return this.accountForm.dirty;
    }

    onSubmit() {
        const rawValue = this.accountForm.getRawValue();
        // The group's required validator means it's set whenever the form is valid.
        if (this.accountForm.valid && rawValue.group) {
            this.save.emit({ ...rawValue, group: rawValue.group });
        }
    }

    onCancelClick() {
        this.cancelled.emit();
    }
}
