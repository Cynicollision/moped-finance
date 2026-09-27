import { Component, Inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Category, CategoryGroup } from '@shared/finance/types';
import { ModalLayoutComponent } from './../../core/modal/modal-layout.component';

export interface CategoryFormModalData {
    category?: Category;
    groups: CategoryGroup[];
    initialGroupId?: string;
}

@Component({
    selector: 'app-category-form-modal',
    standalone: true,
    imports: [
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
        ModalLayoutComponent
    ],
    template: `
        <app-modal-layout [title]="isEditing ? 'Edit Category' : 'Create Category'">
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Name</mat-label>
                <input matInput formControlName="name" placeholder="e.g. Fuel">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Icon (Emoji)</mat-label>
                <input matInput formControlName="icon" placeholder="⛽">
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Group</mat-label>
                <mat-select formControlName="groupId">
                  @for (group of groups; track group) {
                    <mat-option [value]="group.id">
                      {{group.name}} ({{group.class}})
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-checkbox formControlName="isActive">Active</mat-checkbox>
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
export class CategoryFormModalComponent implements OnInit {
    form: FormGroup;
    isEditing = false;
    groups: CategoryGroup[] = [];

    constructor(
        private fb: FormBuilder,
        public dialogRef: MatDialogRef<CategoryFormModalComponent>,
        @Inject(MAT_DIALOG_DATA) public data: CategoryFormModalData
    ) {
        this.form = this.fb.group({
            id: [null],
            name: ['', Validators.required],
            icon: ['', Validators.required],
            groupId: ['', Validators.required],
            isActive: [true]
        });
    }

    ngOnInit() {
        this.groups = this.data.groups;

        if (this.data.category) {
            this.isEditing = true;
            this.form.patchValue(this.data.category);
        } else if (this.data.initialGroupId) {
            this.form.patchValue({ groupId: this.data.initialGroupId });
        }
    }

    save() {
        if (this.form.valid) {
            this.dialogRef.close(this.form.value);
        }
    }
}
