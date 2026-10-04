import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
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
import { BudgetStream, Category, CategoryGroup } from '@shared/finance/types';
import { BudgetStreamType } from '@shared/finance/enum';
import { BudgetStreamUtil } from '@shared/finance/util';
import { ModalCancelDirective } from './../../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../../core/modal/modal-layout.component';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { HasUnsavedChanges } from './../../core/unsaved-changes';
import { FinanceService } from './../finance.service';

const typeLabels: Record<BudgetStreamType, string> = {
    [BudgetStreamType.Income]: 'Income',
    [BudgetStreamType.Expense]: 'Expense',
    [BudgetStreamType.Savings]: 'Savings'
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
        ModalLayoutComponent
    ],
    templateUrl: './budget-form-modal.component.html',
    styleUrl: './budget-form-modal.component.scss'
})
export class FinanceBudgetFormModalComponent implements OnInit, HasUnsavedChanges {
    private fb = inject(FormBuilder);
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);
    private dialogRef = inject<MatDialogRef<FinanceBudgetFormModalComponent, boolean>>(MatDialogRef);
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

    readonly typeString = streamTypeLabel(this.data.type);
    readonly namePlaceholder = namePlaceholders[this.data.type];

    ngOnInit() {
        // Only categories whose class gives this type (BUD-1.1, BUD-1.3): Transfer categories for Savings.
        const groupMap = new Map(this.data.groups.map(g => [g.id, g]));
        const available = this.data.categories.filter(c => {
            const group = groupMap.get(c.groupId);
            return !!group && BudgetStreamUtil.typeOf(group.type) === this.data.type;
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

        this.budgetForm.controls.categoryId.valueChanges.pipe(
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
        ).subscribe(filtered => this.filteredCategories.set(filtered));
    }

    displayCategory = (id: string): string => {
        const category = this.categories().find(c => c.id === id);
        return category ? `${category.icon} ${category.name}` : id;
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

        if (await confirmDeleteStream(this.modalService, stream)
            && await this.financeService.deleteBudgetStream(stream.id)) {
            this.notificationService.success(`${this.typeString} deleted`);
            this.dialogRef.close(true);
        }
    }
}
