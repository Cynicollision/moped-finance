import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { CategoryGroup } from '@shared/finance/types';
import { CategoryClass } from '@shared/finance/enum';
import { ModalCancelDirective } from './../../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../../core/modal/modal-layout.component';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { HasUnsavedChanges } from './../../core/unsaved-changes';
import { FinanceService } from './../finance.service';

export interface CategoryGroupFormModalData {
    /** The group to edit; leave out to create one. */
    group?: CategoryGroup;
    /** How many categories the group holds. It can only be deleted with none (CAT-1.15). */
    categoryCount?: number;
}

/**
 * Creates, edits or deletes a category group (CAT-1.6, CAT-1.7, CAT-1.15). Saves and deletes itself and closes
 * with true once something changed.
 */
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
        ModalCancelDirective,
        ModalLayoutComponent
    ],
    templateUrl: './category-group-form-modal.component.html',
    styleUrl: './category-group-form-modal.component.scss'
})
export class CategoryGroupFormModalComponent implements HasUnsavedChanges {
    private fb = inject(FormBuilder);
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);
    private dialogRef = inject<MatDialogRef<CategoryGroupFormModalComponent, boolean>>(MatDialogRef);
    readonly data = inject<CategoryGroupFormModalData>(MAT_DIALOG_DATA);

    readonly form = this.fb.group({
        id: [null as string | null],
        name: ['', Validators.required],
        class: [CategoryClass.Expense, Validators.required]
    });
    readonly isEditing = !!this.data.group;
    readonly classOptions = Object.values(CategoryClass);
    readonly categoryCount = this.data.categoryCount ?? 0;
    readonly isSaving = signal(false);

    constructor() {
        if (this.data.group) {
            this.form.patchValue(this.data.group);
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
        const { name, class: groupClass } = this.form.getRawValue();
        const values = { name: name!, class: groupClass! };
        const saved = this.data.group
            ? await this.financeService.saveCategoryGroup({ ...this.data.group, ...values })
            : await this.financeService.createCategoryGroup(values);
        this.isSaving.set(false);

        if (saved) {
            this.notificationService.success(this.isEditing ? 'Group saved' : 'Group created');
            this.dialogRef.close(true);
        }
    }

    async delete() {
        const group = this.data.group;
        if (!group || this.categoryCount > 0) {
            return;
        }

        const confirmed = await this.modalService.confirm({
            title: 'Delete Group',
            message: `Delete ${group.name}?`,
            confirmLabel: 'Delete',
            isWarn: true
        });
        if (confirmed && await this.financeService.deleteCategoryGroup(group.id)) {
            this.notificationService.success('Group deleted');
            this.dialogRef.close(true);
        }
    }
}
