import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { CategoryType } from '@shared/finance/enum';
import { Category, CategoryGroup } from '@shared/finance/types';
import { Uncategorized } from '@shared/finance/util';
import { ModalCancelDirective } from './../../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../../core/modal/modal-layout.component';
import { categoryLabel } from './../common/category-label';

export interface CategoryDeleteModalData {
    category: Category;
    /** How many transactions use it; more than none. */
    transactionCount: number;
    groups: CategoryGroup[];
    categories: Category[];
}

/** What the user chose: the category to move the transactions to, or '' for Uncategorized. */
export interface CategoryDeleteChoice {
    moveToId: string;
}

const typeOrder = Object.values(CategoryType);

/**
 * Confirms deleting a category that transactions use, asking where they should move (CAT-4.4). Closes with the choice,
 * and leaves the delete itself to the caller.
 */
@Component({
    selector: 'app-category-delete-modal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        TitleCasePipe,
        ReactiveFormsModule,
        MatDialogModule,
        MatButtonModule,
        MatFormFieldModule,
        MatSelectModule,
        ModalCancelDirective,
        ModalLayoutComponent
    ],
    templateUrl: './category-delete-modal.component.html',
    styleUrl: './category-delete-modal.component.scss'
})
export class CategoryDeleteModalComponent {
    private dialogRef = inject<MatDialogRef<CategoryDeleteModalComponent, CategoryDeleteChoice>>(MatDialogRef);
    readonly data = inject<CategoryDeleteModalData>(MAT_DIALOG_DATA);
    readonly Uncategorized = Uncategorized;
    readonly categoryLabel = categoryLabel;

    readonly form = new FormGroup({ moveTo: new FormControl('', { nonNullable: true }) });
    readonly message =
        this.data.transactionCount === 1
            ? `1 transaction uses ${categoryLabel(this.data.category)}. Choose a category to move it to.`
            : `${this.data.transactionCount} transactions use ${categoryLabel(this.data.category)}. ` +
              'Choose a category to move them to.';

    /** The other active categories, under their groups, ordered as the group picker is (CAT-1.19). */
    readonly targets = [...this.data.groups]
        .sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type) || a.name.localeCompare(b.name))
        .map(group => ({
            group,
            categories: this.data.categories
                .filter(c => c.groupId === group.id && c.isActive && c.id !== this.data.category.id)
                .sort((a, b) => a.name.localeCompare(b.name))
        }))
        .filter(target => target.categories.length > 0);

    confirm() {
        this.dialogRef.close({ moveToId: this.form.controls.moveTo.value });
    }
}
