import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatInputModule } from '@angular/material/input';
import { CalendarPeriod } from '@shared/common/enum';
import { BudgetStream, Category } from '@shared/finance/types';
import { BudgetStreamType, CategoryClass } from '@shared/finance/enum';
import { ModalLayoutComponent } from './../../core/modal/modal-layout.component';
import { signal } from '@angular/core';
import { startWith, map } from 'rxjs';

export interface BudgetFormModalData {
    stream?: BudgetStream;
    type: BudgetStreamType;
    categories: Category[];
}

@Component({
    selector: 'app-budget-form-modal',
    standalone: true,
    imports: [
        CommonModule,
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
    budgetForm: FormGroup;
    isEditing = false;
    recurrenceOptions = Object.values(CalendarPeriod);
    categories = signal<Category[]>([]);
    filteredCategories = signal<Category[]>([]);

    get typeString(): string {
        return this.data.type === BudgetStreamType.Income ? 'Income' : 'Expense';
    }

    constructor(
        private fb: FormBuilder,
        public dialogRef: MatDialogRef<FinanceBudgetFormModalComponent>,
        @Inject(MAT_DIALOG_DATA) public data: BudgetFormModalData
    ) {
        this.budgetForm = this.fb.group({
            id: [null],
            type: [data.type, Validators.required],
            name: ['', Validators.required],
            categoryId: ['', Validators.required],
            amount: [0, [Validators.required, Validators.min(0)]],
            recurrence: [CalendarPeriod.Monthly, Validators.required]
        });
    }

    ngOnInit() {
        const targetClass = this.data.type === BudgetStreamType.Income ? CategoryClass.Income : CategoryClass.Expense;
        const available = this.data.categories.filter(c => c.class === targetClass);
        this.categories.set(available);

        this.setupTypeaheadFilters();

        if (this.data.stream) {
            this.isEditing = true;
            this.budgetForm.patchValue(this.data.stream);
        }
    }

    private setupTypeaheadFilters() {
        const _filterCategories = (value: string | null): Category[] => {
            const filterValue = (value || '').toLowerCase();
            return this.categories().filter(c => c.name.toLowerCase().includes(filterValue));
        };

        this.budgetForm.controls['categoryId'].valueChanges.pipe(
            startWith(''),
            map(value => {
                if (typeof value === 'string') return value;
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
