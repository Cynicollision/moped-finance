import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { BudgetStream, Category } from '@shared/finance/types';
import { BudgetPeriod, BudgetStreamType, CategoryClass } from '@shared/finance/enum';
import { ModalLayoutComponent } from '../../../core/modal/modal-layout.component';

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
        ModalLayoutComponent
    ],
    templateUrl: './budget-form-modal.component.html',
    styleUrl: './budget-form-modal.component.scss'
})
export class BudgetFormModalComponent implements OnInit {
    budgetForm: FormGroup;
    isEditing = false;
    recurrenceOptions = Object.values(BudgetPeriod);
    availableCategories: Category[] = [];

    get typeString(): string {
        return this.data.type === BudgetStreamType.Income ? 'Income' : 'Expense';
    }

    constructor(
        private fb: FormBuilder,
        public dialogRef: MatDialogRef<BudgetFormModalComponent>,
        @Inject(MAT_DIALOG_DATA) public data: BudgetFormModalData
    ) {
        this.budgetForm = this.fb.group({
            id: [null],
            type: [data.type, Validators.required],
            name: ['', Validators.required],
            categoryId: ['', Validators.required],
            amount: [0, [Validators.required, Validators.min(0)]],
            recurrence: [BudgetPeriod.Monthly, Validators.required]
        });
    }

    ngOnInit() {
        const targetClass = this.data.type === BudgetStreamType.Income ? CategoryClass.Income : CategoryClass.Expense;
        this.availableCategories = this.data.categories.filter(c => c.class === targetClass);

        if (this.data.stream) {
            this.isEditing = true;
            this.budgetForm.patchValue(this.data.stream);
        }
    }

    save() {
        if (this.budgetForm.valid) {
            this.dialogRef.close(this.budgetForm.value);
        }
    }
}
