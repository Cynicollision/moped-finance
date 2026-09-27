import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
    changeDetection: ChangeDetectionStrategy.OnPush,
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
    templateUrl: './category-form-modal.component.html',
    styleUrl: './category-form-modal.component.scss'
})
export class CategoryFormModalComponent implements OnInit {
    private fb = inject(FormBuilder);
    private dialogRef = inject<MatDialogRef<CategoryFormModalComponent>>(MatDialogRef);
    readonly data = inject<CategoryFormModalData>(MAT_DIALOG_DATA);

    readonly form = this.fb.group({
        id: [null as string | null],
        name: ['', Validators.required],
        icon: ['', Validators.required],
        groupId: ['', Validators.required],
        isActive: [true]
    });
    readonly isEditing = !!this.data.category;

    ngOnInit() {
        if (this.data.category) {
            this.form.patchValue(this.data.category);
        }
        else if (this.data.initialGroupId) {
            this.form.patchValue({ groupId: this.data.initialGroupId });
        }
    }

    save() {
        if (this.form.valid) {
            this.dialogRef.close(this.form.value);
        }
    }
}
