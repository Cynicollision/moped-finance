import { Component, EventEmitter, Input, Output, inject, OnInit, ChangeDetectorRef, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSelectModule } from '@angular/material/select';
import { Category, Transaction, Account } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { FinanceService } from './../finance.service';

export type TransactionFormMode = 'create' | 'edit' | 'readonly';

@Component({
    selector: 'app-transaction-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatAutocompleteModule,
        MatCheckboxModule,
        MatSelectModule,
        RouterLink
    ],
    templateUrl: './transaction-form.component.html',
    styleUrl: './transaction-form.component.scss'
})
export class TransactionFormComponent implements OnInit, OnChanges {
    @Input() transaction: Transaction | null = null;
    @Input() mode: TransactionFormMode = 'readonly';
    @Input() defaultAccountId?: string;
    @Output() save = new EventEmitter<Partial<Transaction>>();
    @Output() cancel = new EventEmitter<void>();

    private financeService = inject(FinanceService);
    private dateProvider = inject(DateProviderService);
    private cdr = inject(ChangeDetectorRef);

    protected readonly Math = Math;

    transactionForm = new FormGroup({
        accountId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        amount: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required] }),
        merchant: new FormControl<string>('', { nonNullable: true }),
        originalStatement: new FormControl<string>('', { nonNullable: true }),
        category: new FormControl<string>('', { nonNullable: true }),
        date: new FormControl<Date>(this.dateProvider.now(), { nonNullable: true, validators: [Validators.required] }),
        notes: new FormControl<string>('', { nonNullable: true }),
        isHidden: new FormControl<boolean>(false, { nonNullable: true })
    });

    categories: Category[] = [];
    accounts: Account[] = [];
    categoryMap = new Map<string, Category>();

    async ngOnInit() {
        const [categories, accounts] = await Promise.all([
            this.financeService.fetchCategories(false),
            this.financeService.fetchAllAccounts()
        ]);

        if (categories) {
            this.categories = categories;
            categories.forEach(c => this.categoryMap.set(c.id, c));
        }

        if (accounts) {
            this.accounts = accounts;
        }

        this.updateFormState();
        this.cdr.detectChanges();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['transaction'] || changes['mode']) {
            this.updateFormState();
        }
    }

    private updateFormState() {
        if (this.transaction) {
            this.transactionForm.patchValue({
                accountId: this.transaction.accountId,
                amount: this.transaction.amount,
                merchant: this.transaction.merchant || '',
                originalStatement: this.transaction.originalStatement || '',
                category: this.transaction.categoryId || '',
                date: new Date(this.transaction.date),
                notes: this.transaction.notes || '',
                isHidden: this.transaction.isHidden || false
            });
        } else if (this.mode === 'create') {
            this.transactionForm.reset({
                accountId: this.defaultAccountId || '',
                date: this.dateProvider.now(),
                amount: 0,
                isHidden: false
            });
        }

        if (this.mode === 'readonly') {
            this.transactionForm.disable();
        } else {
            this.transactionForm.enable();
            // In edit mode, some fields might still be disabled if they shouldn't be edited
            // Usually, only category, notes, date, and isHidden are editable for imported transactions.
            // If it's a manual transaction, maybe everything is editable. For now, enable all and let user edit.
            // Wait, for standard HomeLab, amount/merchant/account are often read-only on edit.
            // But we will just leave them enabled if mode is 'create' or 'edit'.
            if (this.mode === 'edit') {
                 // For now, allow editing all fields, or we could disable amount/merchant/originalStatement/accountId
                 // since those are usually set in stone by the bank. Let's let them be editable for flexibility.
            }
        }
    }

    getCategoryName(id: string | null | undefined): string {
        if (!id) return '';
        const category = this.categoryMap.get(id);
        return category ? `${category.icon} ${category.name}` : id;
    }

    getAccountName(id: string | null | undefined): string {
        if (!id) return '';
        const account = this.accounts.find(a => a.id === id);
        return account ? account.name : id;
    }

    readonly displayCategory = (id: string | null | undefined): string => this.getCategoryName(id);

    onSave() {
        if (this.transactionForm.invalid) {
            return;
        }

        const formValue = this.transactionForm.getRawValue();

        const updatedTransaction: Partial<Transaction> = {
            ...this.transaction,
            accountId: formValue.accountId,
            amount: formValue.amount,
            merchant: formValue.merchant,
            originalStatement: formValue.originalStatement,
            categoryId: formValue.category,
            date: formValue.date.toISOString(),
            notes: formValue.notes,
            isHidden: formValue.isHidden
        };

        this.save.emit(updatedTransaction);
    }

    onCancel() {
        this.cancel.emit();
    }
}
