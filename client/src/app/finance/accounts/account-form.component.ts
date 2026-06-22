import { Component, EventEmitter, Input, OnInit, Output, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormGroup, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Account } from '@shared/finance/types';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';

@Component({
    selector: 'app-account-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule
    ],
    templateUrl: './account-form.component.html',
    styleUrl: './account-form.component.scss'
})
export class AccountFormComponent implements OnInit, OnChanges {
    @Input() account: Account | null = null;
    @Input() mode: 'create' | 'edit' = 'create';
    @Output() save = new EventEmitter<Partial<Account>>();
    @Output() cancel = new EventEmitter<void>();

    categories = Object.values(AccountCategory);
    groups: AccountGroup[] = [];
    types: AccountType[] = [];

    accountForm = new FormGroup({
        name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        category: new FormControl<AccountCategory>(AccountCategory.Asset, { nonNullable: true, validators: [Validators.required] }),
        group: new FormControl<AccountGroup>(AccountGroup.Cash, { nonNullable: true, validators: [Validators.required] }),
        type: new FormControl<AccountType>(AccountType.Checking, { nonNullable: true, validators: [Validators.required] }),
        isHidden: new FormControl<boolean>(false, { nonNullable: true }),
        isManual: new FormControl<boolean>(true, { nonNullable: true }),
        isRetirement: new FormControl<boolean>(false, { nonNullable: true }),
        hideFromCashflow: new FormControl<boolean>(false, { nonNullable: true }),
        balance: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required, Validators.pattern(/^-?\d+(\.\d{1,2})?$/)] })
    });

    constructor() {
        this.setupSubscriptions();
    }

    ngOnInit() {
        this.updateFormState();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['account']) {
            this.updateFormState();
        }
    }

    private updateFormState() {
        if (this.account) {
            this.updateAvailableGroups(this.account.category);
            this.updateAvailableTypes(this.account.group);

            this.accountForm.patchValue({
                name: this.account.name,
                category: this.account.category,
                group: this.account.group,
                type: this.account.type,
                isHidden: this.account.isHidden,
                isManual: this.account.isManual,
                isRetirement: this.account.isRetirement,
                hideFromCashflow: this.account.hideFromCashflow,
                balance: this.account.balance
            }, { emitEvent: false });

            if (this.account.isManual) {
                this.accountForm.controls.balance.enable({ emitEvent: false });
            } else {
                this.accountForm.controls.balance.disable({ emitEvent: false });
            }
        } else {
            this.updateAvailableGroups(AccountCategory.Asset);
            this.updateAvailableTypes(AccountGroup.Cash);
        }
    }

    private setupSubscriptions() {
        this.accountForm.controls.isManual.valueChanges.subscribe(isManual => {
            const balanceControl = this.accountForm.controls.balance;
            if (isManual) {
                balanceControl.enable();
            } else {
                balanceControl.disable();
                if (this.account) {
                    balanceControl.setValue(this.account.balance || 0);
                } else {
                    balanceControl.setValue(0);
                }
            }
        });

        this.accountForm.controls.category.valueChanges.subscribe(category => {
            this.updateAvailableGroups(category as AccountCategory);
            if (this.groups.length > 0 && !this.groups.includes(this.accountForm.controls.group.value as AccountGroup)) {
                this.accountForm.controls.group.setValue(this.groups[0]);
            } else if (this.groups.length === 0) {
                this.accountForm.controls.group.setValue(null as any);
            }
        });

        this.accountForm.controls.group.valueChanges.subscribe(group => {
            this.updateAvailableTypes(group as AccountGroup);
            if (this.types.length > 0 && !this.types.includes(this.accountForm.controls.type.value as AccountType)) {
                this.accountForm.controls.type.setValue(this.types[0]);
            } else if (this.types.length === 0) {
                this.accountForm.controls.type.setValue(null as any);
            }
        });
    }

    private updateAvailableGroups(category: AccountCategory) {
        if (category === AccountCategory.Asset) {
            this.groups = [AccountGroup.Cash, AccountGroup.Investment, AccountGroup.RealEstate];
        } else if (category === AccountCategory.Liability) {
            this.groups = [AccountGroup.CreditCard, AccountGroup.Loan];
        } else {
            this.groups = [];
        }
    }

    private updateAvailableTypes(group: AccountGroup) {
        switch (group) {
            case AccountGroup.Cash:
                this.types = [AccountType.Checking, AccountType.Savings];
                break;
            case AccountGroup.Investment:
                this.types = [AccountType.Retirement_401k, AccountType.Retirement_IRA, AccountType.Brokerage, AccountType.HSA];
                break;
            case AccountGroup.RealEstate:
                this.types = [AccountType.PrimaryResidence];
                break;
            case AccountGroup.Loan:
                this.types = [AccountType.Mortgage];
                break;
            case AccountGroup.CreditCard:
                this.types = [];
                break;
            default:
                this.types = [];
        }
    }

    onSubmit() {
        if (this.accountForm.valid) {
            const rawValue = this.accountForm.getRawValue();
            this.save.emit({
                ...rawValue,
                balance: typeof rawValue.balance === 'string' ? parseFloat(rawValue.balance) : rawValue.balance
            });
        }
    }

    onCancelClick() {
        this.cancel.emit();
    }
}
