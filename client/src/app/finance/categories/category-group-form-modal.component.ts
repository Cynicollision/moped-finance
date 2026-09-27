import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TitleCasePipe,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        ModalLayoutComponent
    ],
    templateUrl: './category-group-form-modal.component.html',
    styleUrl: './category-group-form-modal.component.scss'
})
export class CategoryGroupFormModalComponent {
    private fb = inject(FormBuilder);
    private dialogRef = inject<MatDialogRef<CategoryGroupFormModalComponent>>(MatDialogRef);
    readonly data = inject<CategoryGroupFormModalData>(MAT_DIALOG_DATA);

    readonly form = this.fb.group({
        id: [null as string | null],
        name: ['', Validators.required],
        class: [CategoryClass.Expense, Validators.required]
    });
    readonly isEditing = !!this.data.group;
    readonly classOptions = Object.values(CategoryClass);

    constructor() {
        if (this.data.group) {
            this.form.patchValue(this.data.group);
        }
    }

    save() {
        if (this.form.valid) {
            this.dialogRef.close(this.form.value);
        }
    }
}
