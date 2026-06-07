import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Account } from '@shared/finance/types';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';
import { ModalService } from './../../core/modal/modal.service';

@Component({
    selector: 'app-account-edit',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule
    ],
    templateUrl: './account-edit.component.html',
    styleUrl: './account-edit.component.scss'
})
export class FinanceAccountEditComponent {
    private fb = inject(FormBuilder);
    private dialogRef = inject(MatDialogRef<FinanceAccountEditComponent>);
    private modalService = inject(ModalService);

    accountForm: FormGroup;
    categories = Object.values(AccountCategory);

    groups: AccountGroup[] = [];
    types: AccountType[] = [];

    constructor(@Inject(MAT_DIALOG_DATA) public data: { account: Account }) {
        this.accountForm = this.fb.group({
            name: [data.account.name, Validators.required],
            category: [data.account.category, Validators.required],
            group: [data.account.group, Validators.required],
            type: [data.account.type, Validators.required],
            isHidden: [data.account.isHidden],
            isManual: [data.account.isManual],
            isRetirement: [data.account.isRetirement],
            hideFromCashflow: [data.account.hideFromCashflow],
            balance: [{ value: data.account.balance, disabled: !data.account.isManual }, [Validators.required, Validators.pattern(/^-?\d+(\.\d{1,2})?$/)]]
        });

        this.accountForm.get('isManual')?.valueChanges.subscribe(isManual => {
            const balanceControl = this.accountForm.get('balance');
            if (isManual) {
                balanceControl?.enable();
            }
            else {
                balanceControl?.disable();
                balanceControl?.setValue(this.data.account.balance); // reset to original value if disabled
            }
        });

        this.accountForm.get('category')?.valueChanges.subscribe(category => {
            this.updateAvailableGroups(category);
            if (this.groups.length > 0 && !this.groups.includes(this.accountForm.get('group')?.value)) {
                this.accountForm.get('group')?.setValue(this.groups[0]);
            }
            else if (this.groups.length === 0) {
                this.accountForm.get('group')?.setValue(null);
            }
        });

        this.accountForm.get('group')?.valueChanges.subscribe(group => {
            this.updateAvailableTypes(group);
            if (this.types.length > 0 && !this.types.includes(this.accountForm.get('type')?.value)) {
                this.accountForm.get('type')?.setValue(this.types[0]);
            }
            else if (this.types.length === 0) {
                this.accountForm.get('type')?.setValue(null);
            }
        });

        // Initialize dropdowns based on initial data
        this.updateAvailableGroups(data.account.category);
        this.updateAvailableTypes(data.account.group);
    }

    private updateAvailableGroups(category: AccountCategory) {
        if (category === AccountCategory.Asset) {
            this.groups = [AccountGroup.Cash, AccountGroup.Investment, AccountGroup.RealEstate];
        }
        else if (category === AccountCategory.Liability) {
            this.groups = [AccountGroup.CreditCard, AccountGroup.Loan];
        }
        else {
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

    onSave() {
        if (this.accountForm.valid) {
            const updatedAccount: Account = {
                ...this.data.account,
                ...this.accountForm.getRawValue(),
                balance: parseFloat(this.accountForm.getRawValue().balance)
            };
            this.dialogRef.close({ action: 'save', account: updatedAccount });
        }
    }

    async onDelete() {
        const confirmed = await this.modalService.confirm({
            title: 'Delete Account',
            message: 'Are you sure you want to delete this account? This action cannot be undone.',
            confirmLabel: 'Delete',
            isWarn: true
        });

        if (confirmed) {
            this.dialogRef.close({ action: 'delete' });
        }
    }

    onCancel() {
        this.dialogRef.close();
    }
}
