import {
    ChangeDetectionStrategy,
    Component,
    computed,
    inject,
    OnInit,
    SimpleChanges,
    OnChanges,
    input,
    output
} from '@angular/core';
import { DatePipe } from '@angular/common';
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
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { CalendarDateUtil } from '@shared/core/util';
import { Transaction } from '@shared/finance/types';
import { Uncategorized } from '@shared/finance/util';
import { DateProviderService } from './../../core/date-provider.service';
import { CardSkeletonComponent } from './../../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../../core/loading/load-error.component';
import { viewResource } from './../../core/loading/view-resource';
import { MoneyComponent } from './../common/money.component';
import { FinanceService } from './../finance.service';

export type TransactionFormMode = 'create' | 'edit' | 'readonly';

@Component({
    selector: 'app-transaction-form',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        ReactiveFormsModule,
        MatButtonModule,
        MatIconModule,
        MatFormFieldModule,
        MatInputModule,
        MatDatepickerModule,
        MatNativeDateModule,
        MatAutocompleteModule,
        MatCheckboxModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        RouterLink,
        CardSkeletonComponent,
        LoadErrorComponent,
        MoneyComponent
    ],
    templateUrl: './transaction-form.component.html',
    styleUrl: './transaction-form.component.scss'
})
export class TransactionFormComponent implements OnInit, OnChanges {
    readonly transaction = input<Transaction | null>(null);
    readonly mode = input<TransactionFormMode>('readonly');
    readonly defaultAccountId = input<string>();
    /** While the parent saves: Save is disabled and shows a spinner. */
    readonly saving = input(false);
    readonly save = output<Partial<Transaction>>();
    readonly cancelled = output<void>();

    private financeService = inject(FinanceService);
    private dateProvider = inject(DateProviderService);
    readonly Uncategorized = Uncategorized;

    readonly transactionForm = new FormGroup({
        accountId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        amount: new FormControl<number>(0, { nonNullable: true, validators: [Validators.required] }),
        merchant: new FormControl<string>('', { nonNullable: true }),
        originalStatement: new FormControl<string>('', { nonNullable: true }),
        category: new FormControl<string>('', { nonNullable: true }),
        date: new FormControl<Date>(this.dateProvider.now(), { nonNullable: true, validators: [Validators.required] }),
        notes: new FormControl<string>('', { nonNullable: true }),
        isHidden: new FormControl<boolean>(false, { nonNullable: true })
    });

    readonly lookups = viewResource({
        loader: async () => {
            const [categories, accounts] = await Promise.all([
                this.financeService.fetchCategories(false),
                this.financeService.fetchAllAccounts()
            ]);
            return { categories, accounts };
        }
    });
    readonly categories = computed(() => this.lookups.value()?.categories ?? []);
    readonly accounts = computed(() => this.lookups.value()?.accounts ?? []);
    private readonly categoryMap = computed(() => new Map(this.categories().map(c => [c.id, c])));
    /** The categories to choose from: active ones, plus the one the transaction already has (CAT-4.1, CAT-4.2). */
    readonly categoryOptions = computed(() => {
        const currentId = this.transaction()?.categoryId;
        return this.categories().filter(c => c.isActive || c.id === currentId);
    });

    ngOnInit() {
        this.updateFormState();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['transaction'] || changes['mode']) {
            this.updateFormState();
        }
    }

    private updateFormState() {
        const transaction = this.transaction();
        const mode = this.mode();
        if (transaction) {
            this.transactionForm.patchValue({
                accountId: transaction.accountId,
                amount: transaction.amount,
                merchant: transaction.merchant || '',
                originalStatement: transaction.originalStatement || '',
                category: transaction.categoryId || '',
                date: CalendarDateUtil.toDate(transaction.date),
                notes: transaction.notes || '',
                isHidden: transaction.isHidden || false
            });
        } else if (mode === 'create') {
            this.transactionForm.reset({
                accountId: this.defaultAccountId() || '',
                date: this.dateProvider.now(),
                amount: 0,
                isHidden: false
            });
        }

        if (mode === 'readonly') {
            this.transactionForm.disable();
        } else {
            // All fields stay editable in edit mode, including bank-provided ones (amount, merchant, account).
            this.transactionForm.enable();
        }
    }

    getCategoryName(id: string | null | undefined): string {
        if (!id) {
            return '';
        }
        const category = this.categoryMap().get(id);
        return category ? `${category.icon} ${category.name}` : id;
    }

    getAccountName(id: string | null | undefined): string {
        if (!id) {
            return '';
        }
        const account = this.accounts().find(a => a.id === id);
        return account ? account.name : id;
    }

    readonly displayCategory = (id: string | null | undefined): string => this.getCategoryName(id);

    onSave() {
        if (this.transactionForm.invalid) {
            return;
        }

        const formValue = this.transactionForm.getRawValue();

        const updatedTransaction: Partial<Transaction> = {
            ...this.transaction(),
            accountId: formValue.accountId,
            amount: formValue.amount,
            merchant: formValue.merchant,
            originalStatement: formValue.originalStatement,
            categoryId: formValue.category,
            date: CalendarDateUtil.fromDate(formValue.date),
            notes: formValue.notes,
            isHidden: formValue.isHidden
        };

        this.save.emit(updatedTransaction);
    }

    hasUnsavedChanges(): boolean {
        return this.transactionForm.dirty;
    }

    onCancel() {
        this.cancelled.emit();
    }
}
