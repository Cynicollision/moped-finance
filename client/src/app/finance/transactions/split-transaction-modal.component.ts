import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DatePipe } from '@angular/common';
import { AbstractControl, FormArray, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { merge } from 'rxjs';
import { TransactionDirection } from '@shared/finance/enum';
import { Category, Transaction, TransactionPartFields } from '@shared/finance/types';
import { TransactionSplit, Uncategorized } from '@shared/finance/util';
import { CardSkeletonComponent } from './../../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../../core/loading/load-error.component';
import { viewResource } from './../../core/loading/view-resource';
import { ModalCancelDirective } from './../../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../../core/modal/modal-layout.component';
import { NotificationService } from './../../core/notification.service';
import { HasUnsavedChanges } from './../../core/unsaved-changes';
import { categoryLabel } from './../common/category-label';
import { MoneyComponent } from './../common/money.component';
import { FinanceService } from './../finance.service';

export interface SplitTransactionModalData {
    transaction: Transaction;
}

type PartForm = FormGroup<{
    // The amount's size, with its sign from the direction, as on the transaction form (TXN-2.13).
    direction: FormControl<TransactionDirection>;
    amount: FormControl<number | null>;
    categoryId: FormControl<string>;
    merchant: FormControl<string>;
    notes: FormControl<string>;
}>;

/**
 * Splits a transaction into parts, or changes the parts of a split one (TXN-4.1 to TXN-4.3, TXN-4.5). Saves itself and
 * closes with true once it has.
 */
@Component({
    selector: 'app-split-transaction-modal',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        ReactiveFormsModule,
        MatAutocompleteModule,
        MatButtonModule,
        MatButtonToggleModule,
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
    private dialogRef = inject<MatDialogRef<SplitTransactionModalComponent, boolean>>(MatDialogRef);
    private destroyRef = inject(DestroyRef);
    readonly transaction = inject<SplitTransactionModalData>(MAT_DIALOG_DATA).transaction;

    readonly Direction = TransactionDirection;
    readonly Uncategorized = Uncategorized;
    readonly minParts = TransactionSplit.minParts;
    readonly maxParts = TransactionSplit.maxParts;
    readonly isEditing = this.transaction.parts.length > 0;
    /** Parts start in the transaction's direction (TXN-4.2). */
    private readonly direction = this.transaction.amount > 0 ? TransactionDirection.In : TransactionDirection.Out;

    readonly lookups = viewResource({ loader: () => this.financeService.fetchCategories(false) });
    private readonly categoryMap = computed(() => new Map((this.lookups.value() ?? []).map(c => [c.id, c])));

    readonly parts = new FormArray<PartForm>([]);
    readonly form = new FormGroup({ parts: this.parts });
    /** Whether the last part fills itself with the remainder, which it does until the user changes it (TXN-4.3). */
    private fillLast = true;
    /** What's left of the total for the parts to cover, signed as the transaction (TXN-4.2). */
    readonly remainder = signal(0);
    /** The remainder as the dialog shows it: positive while the parts come to less than the total. */
    readonly remaining = computed(() => (this.direction === TransactionDirection.Out ? -1 : 1) * this.remainder());
    readonly isSaving = signal(false);

    constructor() {
        const { parts, merchant, categoryId, notes } = this.transaction;
        // A new split starts with the transaction's category and notes on the first part (TXN-4.3).
        const initial: Partial<TransactionPartFields>[] =
            parts.length > 0 ? parts : [{ merchant, categoryId, notes }, { merchant }];
        initial.forEach(part => this.parts.push(this.createPart(part)));
        this.update();
        this.parts.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.update());

        // A category can only be checked once they've loaded.
        effect(() => {
            this.categoryMap();
            this.parts.controls.forEach(part => part.controls.categoryId.updateValueAndValidity({ emitEvent: false }));
        });
    }

    private createPart(part: Partial<TransactionPartFields>): PartForm {
        const amount = part.amount ?? 0;
        const group: PartForm = new FormGroup({
            direction: new FormControl(
                amount === 0 ? this.direction : amount > 0 ? TransactionDirection.In : TransactionDirection.Out,
                { nonNullable: true }
            ),
            amount: new FormControl<number | null>(amount === 0 ? null : Math.abs(amount), {
                validators: [Validators.required, Validators.min(0.01)]
            }),
            categoryId: new FormControl(part.categoryId ?? '', {
                nonNullable: true,
                validators: [control => this.validateCategory(control)]
            }),
            merchant: new FormControl(part.merchant ?? '', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(255)]
            }),
            notes: new FormControl(part.notes ?? '', { nonNullable: true })
        });

        // Changing the last part's amount stops it filling itself.
        merge(group.controls.amount.valueChanges, group.controls.direction.valueChanges)
            .pipe(takeUntilDestroyed(this.destroyRef))
            .subscribe(() => {
                if (group === this.parts.at(-1)) {
                    this.fillLast = false;
                }
            });
        return group;
    }

    /** A category typed but not chosen from the list isn't one. */
    private validateCategory(control: AbstractControl<string>) {
        return !control.value || this.categoryMap().has(control.value) ? null : { unknownCategory: true };
    }

    private signedAmount(part: PartForm): number {
        const { direction, amount } = part.getRawValue();
        return direction === TransactionDirection.Out ? -(amount ?? 0) : (amount ?? 0);
    }

    /** Fills the last part with the remainder when it still fills itself, and works out what's left. */
    private update() {
        const parts = this.parts.controls;
        if (this.fillLast) {
            const last = parts[parts.length - 1];
            const left = TransactionSplit.remainder(
                this.transaction.amount,
                parts.slice(0, -1).map(p => this.signedAmount(p))
            );
            last.patchValue(
                {
                    direction: left > 0 ? TransactionDirection.In : TransactionDirection.Out,
                    amount: left === 0 ? null : Math.abs(left)
                },
                { emitEvent: false }
            );
        }
        this.remainder.set(
            TransactionSplit.remainder(
                this.transaction.amount,
                parts.map(p => this.signedAmount(p))
            )
        );
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
        this.parts.push(this.createPart({ merchant: this.transaction.merchant }));
        this.form.markAsDirty();
    }

    removePart(index: number) {
        if (this.parts.length <= this.minParts) {
            return;
        }
        this.parts.removeAt(index);
        this.form.markAsDirty();
    }

    /** The categories a part can have: Uncategorized and the active ones, plus its own, matching what's typed. */
    categoryOptions(value: string): Category[] {
        const categories = this.lookups.value() ?? [];
        if (this.categoryMap().has(value)) {
            return categories.filter(c => c.isActive || c.id === value);
        }
        const text = value.toLowerCase();
        return categories.filter(c => c.isActive && c.name.toLowerCase().includes(text));
    }

    readonly displayCategory = (id: string): string => {
        const category = this.categoryMap().get(id);
        return category ? categoryLabel(category) : id;
    };

    hasUnsavedChanges(): boolean {
        return this.form.dirty;
    }

    async save() {
        if (this.form.invalid || this.remainder() !== 0 || this.isSaving()) {
            return;
        }

        this.isSaving.set(true);
        const parts = this.parts.controls.map(part => {
            const { categoryId, merchant, notes } = part.getRawValue();
            return { amount: this.signedAmount(part), categoryId, merchant, notes };
        });
        const saved = await this.financeService.splitTransaction(this.transaction.id, parts);
        this.isSaving.set(false);

        if (saved) {
            this.notificationService.success(this.isEditing ? 'Split saved' : 'Transaction split');
            this.form.markAsPristine();
            this.dialogRef.close(true);
        }
    }
}
