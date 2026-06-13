import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatCardModule } from '@angular/material/card';
import { Account } from '@shared/finance/types';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';
import { ModalService } from './../../core/modal/modal.service';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-edit-account',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
        MatCardModule,
        RouterLink
    ],
    templateUrl: './edit-account.component.html',
    styleUrl: './edit-account.component.scss'
})
export class FinanceEditAccountComponent implements OnInit {
    private fb = inject(FormBuilder);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private modalService = inject(ModalService);
    private financeService = inject(FinanceService);
    private cdr = inject(ChangeDetectorRef);

    accountForm?: FormGroup;
    categories = Object.values(AccountCategory);
    groups: AccountGroup[] = [];
    types: AccountType[] = [];

    accountId?: string;
    accountData?: Account;

    async ngOnInit() {
        this.accountId = this.route.snapshot.paramMap.get('accountId') || undefined;
        if (this.accountId) {
            this.accountData = await this.financeService.fetchAccount(this.accountId);
            if (this.accountData) {
                this.initForm(this.accountData);
            }
            else {
                this.router.navigate(['/']); // fallback if not found
            }
        }
    }

    private initForm(account: Account) {
        // Initialize dropdowns based on initial data BEFORE form creation
        // to prevent ExpressionChangedAfterItHasBeenCheckedError on the view bindings
        this.updateAvailableGroups(account.category);
        this.updateAvailableTypes(account.group);

        this.accountForm = this.fb.group({
            name: [account.name, Validators.required],
            category: [account.category, Validators.required],
            group: [account.group, Validators.required],
            type: [account.type, Validators.required],
            isHidden: [account.isHidden],
            isManual: [account.isManual],
            isRetirement: [account.isRetirement],
            hideFromCashflow: [account.hideFromCashflow],
            balance: [{ value: account.balance, disabled: !account.isManual }, [Validators.required, Validators.pattern(/^-?\d+(\.\d{1,2})?$/)]]
        });

        this.accountForm.get('isManual')?.valueChanges.subscribe(isManual => {
            const balanceControl = this.accountForm?.get('balance');
            if (isManual) {
                balanceControl?.enable();
            }
            else {
                balanceControl?.disable();
                if (this.accountData) {
                    balanceControl?.setValue(this.accountData.balance); // reset to original value if disabled
                }
            }
        });

        this.accountForm.get('category')?.valueChanges.subscribe(category => {
            this.updateAvailableGroups(category);
            if (this.groups.length > 0 && !this.groups.includes(this.accountForm?.get('group')?.value)) {
                this.accountForm?.get('group')?.setValue(this.groups[0]);
            }
            else if (this.groups.length === 0) {
                this.accountForm?.get('group')?.setValue(null);
            }
        });

        this.accountForm.get('group')?.valueChanges.subscribe(group => {
            this.updateAvailableTypes(group);
            if (this.types.length > 0 && !this.types.includes(this.accountForm?.get('type')?.value)) {
                this.accountForm?.get('type')?.setValue(this.types[0]);
            }
            else if (this.types.length === 0) {
                this.accountForm?.get('type')?.setValue(null);
            }
        });

        this.cdr.detectChanges();
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

    async onSave() {
        if (this.accountForm?.valid && this.accountData) {
            const updatedAccount: Account = {
                ...this.accountData,
                ...this.accountForm.getRawValue(),
                balance: parseFloat(this.accountForm.getRawValue().balance)
            };
            const result = await this.financeService.saveAccount(updatedAccount);
            if (result) {
                this.router.navigate(['/accounts', this.accountData.id]);
            }
        }
    }

    async onDelete() {
        if (!this.accountData) return;

        const confirmed = await this.modalService.confirm({
            title: 'Delete Account',
            message: 'Are you sure you want to delete this account? This action cannot be undone.',
            confirmLabel: 'Delete',
            isWarn: true
        });

        if (confirmed) {
            const success = await this.financeService.deleteAccount(this.accountData.id);
            if (success) {
                this.router.navigate(['/']); // go back to summary or institutions since account is deleted
            }
        }
    }

    onCancel() {
        if (this.accountData) {
            this.router.navigate(['/accounts', this.accountData.id]);
        } else {
            this.router.navigate(['/']);
        }
    }
}
