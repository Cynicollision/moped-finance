import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CategoryGroup } from '@shared/finance/types';
import { CategoryClass } from '@shared/finance/enum';
import { ModalLayoutComponent } from './../../core/modal/modal-layout.component';

export interface CategoryGroupFormModalData {
    group?: CategoryGroup;
}

@Component({
    selector: 'app-category-group-form-modal',
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
        <app-modal-layout [title]="isEditing ? 'Edit Group' : 'Create Group'">
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="form-row">
                <mat-form-field appearance="outline">
                    <mat-label>Name</mat-label>
                    <input matInput formControlName="name" placeholder="e.g. Auto & Transport">
                </mat-form-field>

                <mat-form-field appearance="outline">
                    <mat-label>Type</mat-label>
                    <mat-select formControlName="class">
                        <mat-option *ngFor="let opt of classOptions" [value]="opt">
                            {{ opt | titlecase }}
                        </mat-option>
                    </mat-select>
                </mat-form-field>
            </div>

            <div modal-actions>
                <button mat-button type="button" mat-dialog-close>Cancel</button>
                <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid">
                    Save
                </button>
            </div>
          </form>
        </app-modal-layout>
    `,
    styles: [`
        .form-row {
            display: flex;
            flex-direction: column;
            gap: 16px;
            padding-top: 8px;
        }
    `]
})
export class CategoryGroupFormModalComponent {
    form: FormGroup;
    isEditing = false;
    classOptions = Object.values(CategoryClass);

    constructor(
        private fb: FormBuilder,
        public dialogRef: MatDialogRef<CategoryGroupFormModalComponent>,
        @Inject(MAT_DIALOG_DATA) public data: CategoryGroupFormModalData
    ) {
        this.form = this.fb.group({
            id: [null],
            name: ['', Validators.required],
            class: [CategoryClass.Expense, Validators.required]
        });

        if (this.data.group) {
            this.isEditing = true;
            this.form.patchValue(this.data.group);
        }
    }

    save() {
        if (this.form.valid) {
            this.dialogRef.close(this.form.value);
        }
    }
}
