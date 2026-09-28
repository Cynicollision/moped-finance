import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Category, CategoryGroup } from '@shared/finance/types';
import { ModalCancelDirective } from './../../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../../core/modal/modal-layout.component';
import { NotificationService } from './../../core/notification.service';
import { HasUnsavedChanges } from './../../core/unsaved-changes';
import { FinanceService } from './../finance.service';

export interface CategoryFormModalData {
    category?: Category;
    groups: CategoryGroup[];
    initialGroupId?: string;
}

/** Creates or edits a category (CAT-1.8, CAT-1.9). Saves itself and closes with true once saved. */
@Component({
    selector: 'app-category-form-modal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatProgressSpinnerModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatCheckboxModule,
        ModalCancelDirective,
        ModalLayoutComponent
    ],
    templateUrl: './category-form-modal.component.html',
    styleUrl: './category-form-modal.component.scss'
})
export class CategoryFormModalComponent implements OnInit, HasUnsavedChanges {
    private fb = inject(FormBuilder);
    private financeService = inject(FinanceService);
    private notificationService = inject(NotificationService);
    private dialogRef = inject<MatDialogRef<CategoryFormModalComponent, boolean>>(MatDialogRef);
    readonly data = inject<CategoryFormModalData>(MAT_DIALOG_DATA);

    readonly form = this.fb.group({
        id: [null as string | null],
        name: ['', Validators.required],
        icon: ['', Validators.required],
        groupId: ['', Validators.required],
        isActive: [true]
    });
    readonly isEditing = !!this.data.category;
    readonly isSaving = signal(false);

    ngOnInit() {
        if (this.data.category) {
            this.form.patchValue(this.data.category);
        }
        else if (this.data.initialGroupId) {
            this.form.patchValue({ groupId: this.data.initialGroupId });
        }
    }

    hasUnsavedChanges(): boolean {
        return this.form.dirty;
    }

    async save() {
        if (this.form.invalid || this.isSaving()) {
            return;
        }

        this.isSaving.set(true);
        const { name, icon, groupId, isActive } = this.form.getRawValue();
        const values = { name: name!, icon: icon!, groupId: groupId!, isActive: isActive ?? true };
        const saved = this.data.category
            ? await this.financeService.saveCategory({ ...this.data.category, ...values })
            : await this.financeService.createCategory(values);
        this.isSaving.set(false);

        if (saved) {
            this.notificationService.success(this.isEditing ? 'Category saved' : 'Category created');
            this.dialogRef.close(true);
        }
    }
}
