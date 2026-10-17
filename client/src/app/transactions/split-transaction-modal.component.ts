import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { CategoryType } from '@shared/finance/enum';
import { Category, Transaction, TransactionSplitPart } from '@shared/finance/types';
import { TransactionSplit, Uncategorized } from '@shared/finance/util';
import { CardSkeletonComponent } from './../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { viewResource } from './../core/loading/view-resource';
import { ModalCancelDirective } from './../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../core/modal/modal-layout.component';
import { NotificationService } from './../core/notification.service';
import { HasUnsavedChanges } from './../core/unsaved-changes';
import { categoryChoices, chosenCategoryValidator } from './../common/category-choice';
import { categoryLabel } from './../common/category-label';
import { MoneyComponent } from './../common/money.component';
import { FinanceService } from './../common/finance.service';

export interface SplitTransactionModalData {
    /** The transaction to split, or any part of a split one. */
    transaction: Transaction;
    /** The parts of its split, in order, when it's split already. */
    parts: Transaction[];
}

type PartForm = FormGroup<{
    /** The part's own transaction, for a part it already has; empty for a new one. */
    id: FormControl<string>;
    /** The amount's size: every part goes the transaction's way (TXN-4.2). */
    amount: FormControl<number | null>;
    categoryId: FormControl<string>;
    merchant: FormControl<string>;
    notes: FormControl<string>;
}>;

/**
 * Splits a transaction, or changes the parts of a split one (TXN-4.1 to TXN-4.3, TXN-4.5). Saves itself and closes with
 * the parts once it has.
 */
@Component({
    selector: 'app-split-transaction-modal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        ReactiveFormsModule,
        MatAutocompleteModule,
        MatButtonModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatProgressSpinnerModule,
        CardSkeletonComponent,
        LoadErrorComponent,
        ModalCancelDirective,
        ModalLayoutComponent,
        MoneyComponent
    ],
    templateUrl: './split-transaction-modal.component.html',
    styleUrl: './split-transaction-modal.component.scss'
})
export class SplitTransactionModalComponent implements HasUnsavedChanges {
    private financeService = inject(FinanceService);
    private notificationService = inject(NotificationService);
    private dialogRef = inject<MatDialogRef<SplitTransactionModalComponent, Transaction[]>>(MatDialogRef);
    private destroyRef = inject(DestroyRef);
    private readonly data = inject<SplitTransactionModalData>(MAT_DIALOG_DATA);

    readonly Uncategorized = Uncategorized;
    readonly minParts = TransactionSplit.minParts;
    readonly maxParts = TransactionSplit.maxParts;
    readonly isEditing = this.data.parts.length > 0;
    private readonly currentParts = this.isEditing ? this.data.parts : [this.data.transaction];
    /** What's split: the transaction's amount, or the parts' total once it's split. */
    readonly total = TransactionSplit.total(this.currentParts.map(part => part.amount));
    /** Every part goes the same way as the total: -1 for money out, 1 for money in (TXN-4.2). */
    private readonly sign = this.total < 0 ? -1 : 1;
    readonly summary = this.data.transaction;

    readonly lookups = viewResource({
        loader: async () => {
            const [categories, groups] = await Promise.all([
                this.financeService.fetchCategories(false),
                this.financeService.fetchCategoryGroups()
            ]);
            return { categories, groups };
        }
    });
    private readonly categoryMap = computed(
        () => new Map((this.lookups.value()?.categories ?? []).map(c => [c.id, c]))
    );
    private readonly typeOf = computed(() => {
        const groupTypes = new Map((this.lookups.value()?.groups ?? []).map(g => [g.id, g.type]));
        return (categoryId: string) => groupTypes.get(this.categoryMap().get(categoryId)?.groupId ?? '');
    });
    /**
     * The category types the parts can have: the type of the transaction's category, or Expense for money out and
     * Income for money in when it has neither, plus Transfer, so extra principal can be split off a loan payment.
     */
    readonly allowedTypes = computed(() => {
        const types = this.currentParts.map(part => this.typeOf()(part.categoryId));
        const own = types.includes(CategoryType.Expense)
            ? CategoryType.Expense
            : types.includes(CategoryType.Income)
              ? CategoryType.Income
              : this.sign < 0
                ? CategoryType.Expense
                : CategoryType.Income;
        return new Set([own, CategoryType.Transfer]);
    });

    readonly parts = new FormArray<PartForm>([]);
    readonly form = new FormGroup({ parts: this.parts });
    /** Whether the last part fills itself with the remainder, which it does until the user changes it (TXN-4.3). */
    private fillLast = true;
    /** What the parts still have to cover, as a size: negative once they come to more than the total (TXN-4.2). */
    readonly remaining = signal(0);
    readonly isSaving = signal(false);

    constructor() {
        const { id, merchant, categoryId, notes } = this.data.transaction;
        // A new split starts from the transaction, with a second part to take the rest (TXN-4.3).
        const initial: Partial<TransactionSplitPart>[] = this.isEditing
            ? this.data.parts
            : [{ id, merchant, categoryId, notes }, { merchant }];
        initial.forEach(part => this.parts.push(this.createPart(part)));
        this.update();
        this.parts.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.update());

        // A category can only be checked once they've loaded.
        effect(() => {
            this.categoryMap();
            this.parts.controls.forEach(part => part.controls.categoryId.updateValueAndValidity({ emitEvent: false }));
        });
    }

    private createPart(part: Partial<TransactionSplitPart>): PartForm {
        const group: PartForm = new FormGroup({
            id: new FormControl(part.id ?? '', { nonNullable: true }),
            amount: new FormControl<number | null>(part.amount ? Math.abs(part.amount) : null, {
                validators: [Validators.required, Validators.min(0.01)]
            }),
            categoryId: new FormControl(part.categoryId ?? '', {
                nonNullable: true,
                validators: [chosenCategoryValidator(this.categoryMap)]
            }),
            merchant: new FormControl(part.merchant ?? '', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(255)]
            }),
            notes: new FormControl(part.notes ?? '', { nonNullable: true })
        });

        // Changing the last part's amount stops it filling itself.
        group.controls.amount.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
            if (group === this.parts.at(-1)) {
                this.fillLast = false;
            }
        });
        return group;
    }

    private signedAmount(part: PartForm): number {
        return this.sign * (part.controls.amount.value ?? 0);
    }

    /** Fills the last part with the remainder when it still fills itself, and works out what's left. */
    private update() {
        const parts = this.parts.controls;
        if (this.fillLast) {
            const left = TransactionSplit.remainder(
                this.total,
                parts.slice(0, -1).map(p => this.signedAmount(p))
            );
            // Nothing, or less than nothing, is left for it once the others cover the total.
            const size = this.sign * left;
            parts[parts.length - 1].controls.amount.setValue(size > 0 ? size : null, { emitEvent: false });
        }
        const left = TransactionSplit.remainder(
            this.total,
            parts.map(p => this.signedAmount(p))
        );
        this.remaining.set(this.sign * left);
    }

    /** Adds a last part, which takes over the remainder (TXN-4.3). */
    addPart() {
        if (this.parts.length >= this.maxParts) {
            return;
        }
        if (this.fillLast) {
            this.parts.at(-1).controls.amount.setValue(null, { emitEvent: false });
        }
        this.fillLast = true;
        this.parts.push(this.createPart({ merchant: this.data.transaction.merchant }));
        this.form.markAsDirty();
    }

    removePart(index: number) {
        if (this.parts.length <= this.minParts) {
            return;
        }
        this.parts.removeAt(index);
        this.form.markAsDirty();
    }

    /**
     * The categories a part can have, matching what's typed: the active ones of the allowed types (`allowedTypes`),
     * plus the one it has.
     */
    categoryOptions(value: string): Category[] {
        return categoryChoices(
            this.lookups.value()?.categories ?? [],
            value,
            c => c.isActive && this.allowedTypes().has(this.typeOf()(c.id)!)
        );
    }

    readonly displayCategory = (id: string): string => {
        const category = this.categoryMap().get(id);
        return category ? categoryLabel(category) : id;
    };

    hasUnsavedChanges(): boolean {
        return this.form.dirty;
    }

    async save() {
        if (this.form.invalid || this.remaining() !== 0 || this.isSaving()) {
            return;
        }

        this.isSaving.set(true);
        const parts: TransactionSplitPart[] = this.parts.controls.map(part => {
            const { id, categoryId, merchant, notes } = part.getRawValue();
            return { ...(id ? { id } : {}), amount: this.signedAmount(part), categoryId, merchant, notes };
        });
        const saved = await this.financeService.splitTransaction(this.data.transaction.id, parts);
        this.isSaving.set(false);

        if (saved) {
            this.notificationService.success(this.isEditing ? 'Split saved' : 'Transaction split');
            this.form.markAsPristine();
            this.dialogRef.close(saved);
        }
    }
}
