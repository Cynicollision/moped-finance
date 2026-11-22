import {
    ChangeDetectionStrategy,
    Component,
    computed,
    effect,
    inject,
    OnInit,
    SimpleChanges,
    OnChanges,
    input,
    output
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { CalendarDateUtil } from '@shared/core/util';
import { BankSyncWording } from '@shared/finance/contracts';
import { TransactionDirection } from '@shared/finance/enum';
import { Category, Transaction } from '@shared/finance/types';
import { TransactionSplit, Uncategorized } from '@shared/finance/util';
import { DateProviderService } from './../core/date-provider.service';
import { CardSkeletonComponent } from './../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { viewResource } from './../core/loading/view-resource';
import { categoryChoices, chosenCategoryValidator } from './../common/category-choice';
import { categoryLabel } from './../common/category-label';
import { MoneyComponent } from './../common/money.component';
import { FinanceService } from './../common/finance.service';

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
        MatButtonToggleModule,
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
    /** The parts of its split, in order, when it's split (TXN-4.5). */
    readonly splitParts = input<Transaction[]>([]);
    readonly mode = input<TransactionFormMode>('readonly');
    readonly defaultAccountId = input<string>();
    /** While the parent saves: Save is disabled and shows a spinner. */
    readonly saving = input(false);
    readonly save = output<Partial<Transaction>>();
    readonly cancelled = output<void>();

    private financeService = inject(FinanceService);
    private dateProvider = inject(DateProviderService);
    readonly Uncategorized = Uncategorized;
    readonly Direction = TransactionDirection;
    readonly syncedNote = BankSyncWording.syncedFields;
    /** Transactions record what has happened, so the date stops at today (APP-8.1). */
    readonly latestDate = this.dateProvider.now();

    readonly transactionForm = new FormGroup({
        accountId: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] }),
        // The amount's size, with its sign from the direction (TXN-2.13, APP-6.3).
        direction: new FormControl<TransactionDirection>(TransactionDirection.Out, { nonNullable: true }),
        amount: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0.01)] }),
        merchant: new FormControl<string>('', {
            nonNullable: true,
            validators: [Validators.required, Validators.maxLength(255)]
        }),
        originalStatement: new FormControl<string>('', { nonNullable: true }),
        category: new FormControl<string>('', {
            nonNullable: true,
            validators: [chosenCategoryValidator(() => this.categoryMap())]
        }),
        date: new FormControl<Date>(this.dateProvider.now(), { nonNullable: true, validators: [Validators.required] }),
        notes: new FormControl<string>('', { nonNullable: true }),
        isHidden: new FormControl<boolean>(false, { nonNullable: true }),
        // Checked by default on Add (TXN-2.8).
        adjustsBalance: new FormControl<boolean>(true, { nonNullable: true })
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
    /**
     * The accounts to choose from, by name: open, unhidden ones, plus the one the transaction is in or the form was
     * opened from (TXN-2.1).
     */
    readonly accountOptions = computed(() => {
        const keep = [this.transaction()?.accountId, this.defaultAccountId()];
        return this.accounts().filter(a => (!a.isHidden && !a.closedOn) || keep.includes(a.id));
    });
    private readonly accountId = toSignal(this.transactionForm.controls.accountId.valueChanges, {
        initialValue: this.transactionForm.controls.accountId.value
    });
    /** Only a manual account's transactions can adjust its balance (TXN-2.8, TXN-2.9, ACCT-5.5). */
    readonly canAdjustBalance = computed(() => this.accounts().find(a => a.id === this.accountId())?.isManual ?? false);
    private readonly categoryMap = computed(() => new Map(this.categories().map(c => [c.id, c])));
    /** One part of a split, whose amount changes only with Edit split (TXN-4.7). */
    readonly isSplit = computed(() => !!this.transaction()?.splitId);
    /** Added by bank sync, so its date, amount, account and original statement are the bank's (TXN-2.12). */
    readonly isSynced = computed(() => !!this.transaction()?.isSynced);
    /** What the split's parts add up to. */
    readonly splitTotal = computed(() => TransactionSplit.total(this.splitParts().map(part => part.amount)));

    constructor() {
        // A category can only be checked once they've loaded.
        effect(() => {
            this.categoryMap();
            this.transactionForm.controls.category.updateValueAndValidity({ emitEvent: false });
        });
    }

    /**
     * The categories to choose from, matching what's typed (TXN-2.1): active ones, plus the one the transaction already
     * has (CAT-4.1, CAT-4.2).
     */
    categoryOptions(value: string): Category[] {
        const currentId = this.transaction()?.categoryId;
        return categoryChoices(this.categories(), value, c => c.isActive || c.id === currentId);
    }

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
                direction: transaction.amount > 0 ? TransactionDirection.In : TransactionDirection.Out,
                amount: Math.abs(transaction.amount),
                merchant: transaction.merchant || '',
                originalStatement: transaction.originalStatement || '',
                category: transaction.categoryId || '',
                date: CalendarDateUtil.toDate(transaction.date),
                notes: transaction.notes || '',
                isHidden: transaction.isHidden || false,
                adjustsBalance: transaction.adjustsBalance
            });
        } else if (mode === 'create') {
            this.transactionForm.reset({
                accountId: this.defaultAccountId() || '',
                date: this.dateProvider.now(),
                direction: TransactionDirection.Out,
                amount: null,
                isHidden: false,
                adjustsBalance: true
            });
        }

        if (mode === 'readonly') {
            this.transactionForm.disable();
        } else {
            // Every field is editable except a part's amount, which changes with the others in Edit split (TXN-4.7),
            // and a synced transaction's bank fields (TXN-2.12).
            this.transactionForm.enable();
            const controls = this.transactionForm.controls;
            if (this.isSplit() || this.isSynced()) {
                controls.amount.disable();
                controls.direction.disable();
            }
            if (this.isSynced()) {
                controls.date.disable();
                controls.accountId.disable();
                controls.originalStatement.disable();
            }
        }
    }

    getCategoryName(id: string | null | undefined): string {
        if (!id) {
            return '';
        }
        const category = this.categoryMap().get(id);
        return category ? categoryLabel(category) : id;
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
        const size = formValue.amount ?? 0;

        const updatedTransaction: Partial<Transaction> = {
            ...this.transaction(),
            accountId: formValue.accountId,
            amount: formValue.direction === TransactionDirection.Out ? -size : size,
            merchant: formValue.merchant,
            originalStatement: formValue.originalStatement,
            categoryId: formValue.category,
            date: CalendarDateUtil.fromDate(formValue.date),
            notes: formValue.notes,
            isHidden: formValue.isHidden,
            adjustsBalance: this.canAdjustBalance() && formValue.adjustsBalance
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
