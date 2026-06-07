import { Component, inject, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Category, Transaction } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-transaction-details',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterLink,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatAutocompleteModule,
        MatCheckboxModule
    ],
    templateUrl: './transaction-details.component.html',
    styleUrl: './transaction-details.component.scss'
})
export class FinanceTransactionDetailsComponent implements OnInit {
    private financeService = inject(FinanceService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private cdr = inject(ChangeDetectorRef);
    private dateProvider = inject(DateProviderService);
    protected readonly Math = Math;

    transactionForm = new FormGroup({
        category: new FormControl<string>('', { nonNullable: true }),
        date: new FormControl<Date>(this.dateProvider.now(), { nonNullable: true, validators: [Validators.required] }),
        notes: new FormControl<string>('', { nonNullable: true }),
        isHidden: new FormControl<boolean>(false, { nonNullable: true })
    });

    transactionId: string | null = null;
    transaction = signal<Transaction | null>(null);
    accountName = signal<string>('');

    categories = signal<Category[]>([]);
    categoryMap = new Map<string, Category>();

    async ngOnInit() {
        this.transactionId = this.route.snapshot.paramMap.get('transactionId');

        const categories = await this.financeService.fetchCategories(false);
        if (categories) {
            this.categories.set(categories);
            categories.forEach(c => this.categoryMap.set(c.id, c));
        }

        if (this.transactionId) {
            const transaction = await this.financeService.fetchTransaction(this.transactionId);
            if (transaction) {
                const account = await this.financeService.fetchAccount(transaction.accountId);
                this.accountName.set(account?.name || transaction.accountId);

                this.transactionForm.patchValue({
                    category: transaction.categoryId,
                    date: new Date(transaction.date),
                    notes: transaction.notes || '',
                    isHidden: transaction.isHidden
                });

                this.transaction.set(transaction);
                this.cdr.detectChanges();
            }
        }
    }

    getCategoryName(id: string | null | undefined): string {
        if (!id) return '';
        const category = this.categoryMap.get(id);
        return category ? `${category.icon} ${category.name}` : id;
    }

    readonly displayCategory = (id: string | null | undefined): string => this.getCategoryName(id);

    async save() {
        const transaction = this.transaction();
        if (!transaction || this.transactionForm.invalid) {
            return;
        }

        const formValue = this.transactionForm.getRawValue();

        const updatedTransaction: Transaction = {
            ...transaction,
            categoryId: formValue.category,
            date: formValue.date.toISOString(),
            notes: formValue.notes,
            isHidden: formValue.isHidden
        };

        const result = await this.financeService.saveTransaction(updatedTransaction);
        if (result) {
            this.router.navigate(['/transactions']);
        }
    }

    cancel() {
        this.router.navigate(['/transactions']);
    }

    async deleteTransaction() {
        if (!this.transactionId) return;

        const confirmDelete = confirm('Are you sure you want to delete this transaction?');
        if (confirmDelete) {
            const success = await this.financeService.deleteTransaction(this.transactionId);
            if (success) {
                this.router.navigate(['/transactions']);
            }
        }
    }
}