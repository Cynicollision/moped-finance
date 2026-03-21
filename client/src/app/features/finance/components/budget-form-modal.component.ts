import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { BudgetStream, Category } from '@shared/finance/types';
import { BudgetStreamType, BudgetStreamRecurrence, CategoryClass } from '@shared/finance/enum';
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
  template: `
    <app-modal-layout [title]="isEditing ? 'Edit ' + typeString : 'Add ' + typeString">
      <form [formGroup]="budgetForm" (ngSubmit)="save()" class="budget-form">
        <div class="form-row">
            <mat-form-field appearance="outline">
                <mat-label>Name</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Salary, Rent">
            </mat-form-field>

            <mat-form-field appearance="outline">
                <mat-label>Category</mat-label>
                <mat-select formControlName="categoryId">
                    <mat-option *ngFor="let cat of availableCategories" [value]="cat.id">
                        {{cat.icon}} {{cat.name}}
                    </mat-option>
                </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
                <mat-label>Amount</mat-label>
                <input matInput type="number" formControlName="amount" prefix="$">
            </mat-form-field>

            <div class="recurrence-group">
                <mat-form-field appearance="outline" class="multiple-field">
                    <mat-label>Every</mat-label>
                    <input matInput type="number" formControlName="recurrenceMultiple">
                </mat-form-field>

                <mat-form-field appearance="outline" class="recurrence-field">
                    <mat-label>Recurrence</mat-label>
                    <mat-select formControlName="recurrence">
                        <mat-option *ngFor="let opt of recurrenceOptions" [value]="opt">
                            {{opt}}
                        </mat-option>
                    </mat-select>
                </mat-form-field>
            </div>
        </div>

        <div modal-actions>
            <button mat-button type="button" mat-dialog-close>Cancel</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="budgetForm.invalid">
                Save
            </button>
        </div>
      </form>
    </app-modal-layout>
  `,
  styles: [`
    .budget-form {
      min-width: 350px;
    }
    .form-row { 
      display: flex; 
      flex-direction: column; 
    }
    .recurrence-group { 
      display: flex; 
      gap: 16px; 
    }
    .multiple-field {
      flex: 1;
    }
    .recurrence-field {
      flex: 2;
    }
  `]
})
export class BudgetFormModalComponent implements OnInit {
   budgetForm: FormGroup;
   isEditing = false;
   recurrenceOptions = Object.values(BudgetStreamRecurrence);
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
          recurrence: [BudgetStreamRecurrence.Monthly, Validators.required],
          recurrenceMultiple: [1, [Validators.required, Validators.min(1)]]
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
