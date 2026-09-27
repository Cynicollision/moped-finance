import { ChangeDetectionStrategy, Component, OnInit, signal, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { startWith, map } from 'rxjs';
import { CalendarPeriod } from '@shared/core/enum';
import { BudgetStream, Category, CategoryGroup } from '@shared/finance/types';
import { BudgetStreamType, CategoryClass } from '@shared/finance/enum';
import { ModalLayoutComponent } from './../../core/modal/modal-layout.component';

export interface BudgetFormModalData {
    stream?: BudgetStream;
    type: BudgetStreamType;
    categories: Category[];
    groups: CategoryGroup[];
}

@Component({
    selector: 'app-budget-form-modal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatAutocompleteModule,
        ModalLayoutComponent
    ],
    templateUrl: './budget-form-modal.component.html',
    styleUrl: './budget-form-modal.component.scss'
})
export class FinanceBudgetFormModalComponent implements OnInit {
    private fb = inject(FormBuilder);
    private dialogRef = inject<MatDialogRef<FinanceBudgetFormModalComponent>>(MatDialogRef);
    readonly data = inject<BudgetFormModalData>(MAT_DIALOG_DATA);

    readonly budgetForm = this.fb.group({
        id: [null as string | null],
        type: [this.data.type, Validators.required],
        name: ['', Validators.required],
        categoryId: ['', Validators.required],
        amount: [0, [Validators.required, Validators.min(0)]],
        recurrence: [CalendarPeriod.Monthly, Validators.required]
    });
    readonly isEditing = !!this.data.stream;
    readonly recurrenceOptions = Object.values(CalendarPeriod);
    readonly categories = signal<Category[]>([]);
    readonly filteredCategories = signal<Category[]>([]);

    get typeString(): string {
        return this.data.type === BudgetStreamType.Income ? 'Income' : 'Expense';
    }

    ngOnInit() {
        const targetClass = this.data.type === BudgetStreamType.Income ? CategoryClass.Income : CategoryClass.Expense;
        const groupMap = new Map(this.data.groups.map(g => [g.id, g]));
        const available = this.data.categories.filter(c => {
            const group = groupMap.get(c.groupId);
            return group?.class === targetClass;
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

    save() {
        if (this.budgetForm.valid) {
            this.dialogRef.close(this.budgetForm.value);
        }
    }
}
