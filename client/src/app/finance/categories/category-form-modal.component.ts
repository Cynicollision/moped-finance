import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TitleCasePipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { CategoryNecessity, CategoryType } from '@shared/finance/enum';
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

const typeOrder = Object.values(CategoryType);

/** Creates or edits a category (CAT-1.8, CAT-1.9, CAT-3.2). Saves itself and closes with true once saved. */
@Component({
    selector: 'app-category-form-modal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TitleCasePipe,
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
        isActive: [true],
        necessity: [null as CategoryNecessity | null]
    });
    readonly isEditing = !!this.data.category;
    /** The groups to choose from: Income, then Expense, then Transfer, each by name (CAT-1.19). */
    readonly groups = [...this.data.groups].sort((a, b) =>
        (typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)) || a.name.localeCompare(b.name));
    readonly isSaving = signal(false);

    /** Necessity applies only to Expense categories, and is optional (CAT-3.2). */
    readonly necessityOptions = [
        { value: null, label: 'Not set' },
        { value: CategoryNecessity.Essential, label: 'Essential' },
        { value: CategoryNecessity.Discretionary, label: 'Discretionary' }
    ];
    private readonly groupId = toSignal(this.form.controls.groupId.valueChanges, { initialValue: this.form.controls.groupId.value });
    readonly isExpenseGroup = computed(() => this.data.groups.find(g => g.id === this.groupId())?.type === CategoryType.Expense);

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
        const { name, icon, groupId, isActive, necessity } = this.form.getRawValue();
        // Moving a category out of Expense clears its necessity (CAT-1.17).
        const values = {
            name: name!, icon: icon!, groupId: groupId!, isActive: isActive ?? true, necessity: this.isExpenseGroup() ? necessity : null
        };
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
