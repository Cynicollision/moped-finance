import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { Account, Institution } from '@shared/finance/types';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-add-account',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterLink,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
        MatIconModule
    ],
    templateUrl: './add-account.component.html',
    styleUrl: './add-account.component.scss'
})
export class FinanceAddAccountComponent implements OnInit {
    private fb = inject(FormBuilder);
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private cdr = inject(ChangeDetectorRef);

    mode: 'selection' | 'manual' = 'selection';
    accountForm?: FormGroup;

    institutionId?: string;
    institution?: Institution;

    categories = Object.values(AccountCategory);
    groups: AccountGroup[] = [];
    types: AccountType[] = [];

    async ngOnInit() {
        this.institutionId = this.route.snapshot.paramMap.get('id') || undefined;
        if (this.institutionId) {
            this.institution = await this.financeService.fetchInstitution(this.institutionId);
            if (!this.institution) {
                this.router.navigate(['/institutions']);
                return;
            }
            this.initForm();
        }
        else {
            this.router.navigate(['/institutions']);
        }
    }

    private initForm() {
        this.updateAvailableGroups(AccountCategory.Asset);
        this.updateAvailableTypes(AccountGroup.Cash);

        this.accountForm = this.fb.group({
            name: ['', Validators.required],
            category: [AccountCategory.Asset, Validators.required],
            group: [AccountGroup.Cash, Validators.required],
            type: [AccountType.Checking, Validators.required],
            isHidden: [false],
            isManual: [true],
            isRetirement: [false],
            hideFromCashflow: [false],
            balance: [0, [Validators.required, Validators.pattern(/^-?\d+(\.\d{1,2})?$/)]]
        });

        this.accountForm.get('isManual')?.valueChanges.subscribe(isManual => {
            const balanceControl = this.accountForm?.get('balance');
            if (isManual) {
                balanceControl?.enable();
            }
            else {
                balanceControl?.disable();
                balanceControl?.setValue(0);
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

    setMode(mode: 'selection' | 'manual') {
        this.mode = mode;
    }

    async onSubmit() {
        if (this.accountForm?.valid && this.institutionId) {
            const rawValue = this.accountForm.getRawValue();
            const newAccount: Account = {
                id: '',
                userId: '',
                institutionId: this.institutionId,
                name: rawValue.name,
                category: rawValue.category,
                group: rawValue.group,
                type: rawValue.type,
                balance: parseFloat(rawValue.balance),
                isHidden: rawValue.isHidden,
                isManual: rawValue.isManual,
                isRetirement: rawValue.isRetirement,
                hideFromCashflow: rawValue.hideFromCashflow
            } as Account;

            const created = await this.financeService.createAccount(newAccount);
            if (created) {
                this.router.navigate(['/institutions']);
            }
        }
    }
}
