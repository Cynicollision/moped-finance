import { ChangeDetectionStrategy, Component, OnInit, computed, signal, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { startWith, map } from 'rxjs';
import { CalendarPeriod } from '@shared/core/enum';
import { SpendingAverage } from '@shared/finance/contracts';
import { BudgetStream, Category, CategoryGroup } from '@shared/finance/types';
import { BudgetStreamType, CategoryType } from '@shared/finance/enum';
import { BudgetStreamUtil } from '@shared/finance/util';
import { ModalCancelDirective } from './../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../core/modal/modal-layout.component';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { HasUnsavedChanges } from './../core/unsaved-changes';
import { categoryLabel } from './../common/category-label';
import { MoneyComponent } from './../common/money.component';
import { FinanceService } from './../common/finance.service';

const typeLabels: Record<BudgetStreamType, string> = {
    [BudgetStreamType.Income]: 'Income',
    [BudgetStreamType.Expense]: 'Expense',
    [BudgetStreamType.Savings]: 'Savings'
};

// Which Spending totals a stream's category is averaged from: income, expenses or savings (CASH-1.3).
const totalTypes: Record<BudgetStreamType, CategoryType> = {
    [BudgetStreamType.Income]: CategoryType.Income,
    [BudgetStreamType.Expense]: CategoryType.Expense,
    [BudgetStreamType.Savings]: CategoryType.Transfer
};

const namePlaceholders: Record<BudgetStreamType, string> = {
    [BudgetStreamType.Income]: 'e.g. Salary',
    [BudgetStreamType.Expense]: 'e.g. Rent',
    [BudgetStreamType.Savings]: 'e.g. Emergency fund'
};

/** "Income", "Expense" or "Savings", for titles and messages (BUD-1.3, BUD-1.4). */
export function streamTypeLabel(type: BudgetStreamType): string {
    return typeLabels[type];
}

/** Asks before deleting a budget stream (APP-2.4), from its dialog or its row menu. */
export async function confirmDeleteStream(modalService: ModalService, stream: BudgetStream): Promise<boolean> {
    const confirmed = await modalService.confirm({
        title: 'Delete Budget Stream',
        message: `Delete ${stream.name}?`,
        confirmLabel: 'Delete',
        isWarn: true
    });
    return confirmed === true;
}

export interface BudgetFormModalData {
    stream?: BudgetStream;
    type: BudgetStreamType;
    categories: Category[];
    groups: CategoryGroup[];
    /** Every stream, for the category's others (BUD-1.8). */
    streams: BudgetStream[];
    /** The average month, for the chosen category's (BUD-1.8). */
    average?: SpendingAverage;
}

/** What the panel says about the chosen category (BUD-1.8). */
export interface CategoryInsight {
    name: string;
    /** Its average month, and over how long ("12 months", "month"); undefined with no history. */
    average?: { amount: number; over: string };
    /** Its other streams, as a monthly amount; undefined when it has none. */
    others?: { count: number; monthly: number };
}

/**
 * Adds, edits or deletes a budget stream (BUD-1.3, BUD-1.4), in a side panel (ModalOptions size 'panel'). Saves
 * and deletes itself and closes with true once something changed.
 */
@Component({
    selector: 'app-budget-form-modal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatAutocompleteModule,
        ModalCancelDirective,
        ModalLayoutComponent,
        MoneyComponent
    ],
    templateUrl: './budget-form-modal.component.html',
    styleUrl: './budget-form-modal.component.scss'
})
export class BudgetFormModalComponent implements OnInit, HasUnsavedChanges {
    private fb = inject(FormBuilder);
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);
    private dialogRef = inject<MatDialogRef<BudgetFormModalComponent, boolean>>(MatDialogRef);
    readonly data = inject<BudgetFormModalData>(MAT_DIALOG_DATA);

    readonly budgetForm = this.fb.group({
        name: ['', Validators.required],
        categoryId: ['', Validators.required],
        amount: [0, [Validators.required, Validators.min(0)]],
        recurrence: [CalendarPeriod.Monthly, Validators.required]
    });
    readonly isEditing = !!this.data.stream;
    readonly isSaving = signal(false);
    readonly recurrenceOptions = Object.values(CalendarPeriod);
    readonly categories = signal<Category[]>([]);
    readonly filteredCategories = signal<Category[]>([]);

    /** The chosen category's ID, once the field holds one rather than typed text. */
    private readonly categoryId = signal('');
    readonly categoryInsight = computed(() => this.insightFor(this.categoryId()));

    readonly typeString = streamTypeLabel(this.data.type);
    readonly namePlaceholder = namePlaceholders[this.data.type];

    ngOnInit() {
        // Only categories whose type gives the stream's type (BUD-1.1, BUD-1.3): Transfer categories for Savings. Inactive
        // ones are left out, except the one the stream already has (CAT-4.1, CAT-4.2).
        const groupMap = new Map(this.data.groups.map(g => [g.id, g]));
        const available = this.data.categories.filter(c => {
            const group = groupMap.get(c.groupId);
            const isOffered = c.isActive || c.id === this.data.stream?.categoryId;
            return isOffered && !!group && BudgetStreamUtil.typeOf(group.type) === this.data.type;
        });
        this.categories.set(available);

        this.setupTypeaheadFilters();

        if (this.data.stream) {
            this.budgetForm.patchValue(this.data.stream);
        }
    }

    private setupTypeaheadFilters() {
        const _filterCategories = (value: string | null): Category[] => {
            const filterValue = (value || '').toLowerCase();
            return this.categories().filter(c => c.name.toLowerCase().includes(filterValue));
        };

        this.budgetForm.controls.categoryId.valueChanges
            .pipe(
                startWith(''),
                map(value => {
                    if (typeof value === 'string') {
                        return value;
                    }
                    // If it's an ID (from patchValue), we need to find the name if we want to filter,
                    // but since we display name in the input, usually value is the name or empty.
                    const cat = this.categories().find(c => c.id === value);
                    return cat ? cat.name : '';
                }),
                map(name => _filterCategories(name))
            )
            .subscribe(filtered => this.filteredCategories.set(filtered));

        this.budgetForm.controls.categoryId.valueChanges
            .pipe(startWith(this.budgetForm.controls.categoryId.value))
            .subscribe(value => this.categoryId.set(value ?? ''));
    }

    // The category's average month (Income and Expense by their net, Transfer by what it saved) and its other
    // streams, the one being edited left out (BUD-1.8).
    private insightFor(categoryId: string): CategoryInsight | undefined {
        const category = this.categories().find(c => c.id === categoryId);
        if (!category) {
            return undefined;
        }

        const insight: CategoryInsight = { name: category.name };
        const average = this.data.average;
        if (average && average.months > 0) {
            const total = average.totals.find(
                t => t.type === totalTypes[this.data.type] && t.categoryId === categoryId
            );
            insight.average = {
                amount: total?.amount ?? 0,
                over: average.months === 1 ? 'month' : `${average.months} months`
            };
        }

        const others = this.data.streams.filter(s => s.categoryId === categoryId && s.id !== this.data.stream?.id);
        if (others.length > 0) {
            insight.others = {
                count: others.length,
                monthly: others.reduce((sum, s) => sum + BudgetStreamUtil.monthlyAmount(s), 0)
            };
        }
        return insight;
    }

    displayCategory = (id: string): string => {
        const category = this.categories().find(c => c.id === id);
        return category ? categoryLabel(category) : id;
    };

    hasUnsavedChanges(): boolean {
        return this.budgetForm.dirty;
    }

    async save() {
        if (this.budgetForm.invalid || this.isSaving()) {
            return;
        }

        this.isSaving.set(true);
        const { name, categoryId, amount, recurrence } = this.budgetForm.getRawValue();
        const values = { name: name!, categoryId: categoryId!, amount: amount!, recurrence: recurrence! };
        const saved = this.data.stream
            ? await this.financeService.saveBudgetStream({ ...this.data.stream, ...values })
            : await this.financeService.createBudgetStream(values);
        this.isSaving.set(false);

        if (saved) {
            this.notificationService.success(`${this.typeString} ${this.isEditing ? 'saved' : 'added'}`);
            this.dialogRef.close(true);
        }
    }

    async delete() {
        const stream = this.data.stream;
        if (!stream) {
            return;
        }

        if (
            (await confirmDeleteStream(this.modalService, stream)) &&
            (await this.financeService.deleteBudgetStream(stream.id))
        ) {
            this.notificationService.success(`${this.typeString} deleted`);
            this.dialogRef.close(true);
        }
    }
}
