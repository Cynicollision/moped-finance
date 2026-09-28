import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Institution } from '@shared/finance/types';
import { ModalCancelDirective } from './../../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../../core/modal/modal-layout.component';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { HasUnsavedChanges } from './../../core/unsaved-changes';
import { FinanceService } from './../finance.service';

export interface InstitutionDialogData {
    /** The institution to edit; leave out to add one. */
    institution?: Institution;
    /** How many accounts the institution holds. It can only be deleted with none (INST-1.9). */
    accountCount?: number;
}

/**
 * Adds or edits an institution, and deletes one (INST-1.4, INST-1.6, INST-1.8). Saves and deletes itself,
 * staying open if the server refuses, and closes with true once something changed.
 */
@Component({
    selector: 'app-institution-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatDialogModule,
        MatFormFieldModule,
        MatInputModule,
        ModalCancelDirective,
        ModalLayoutComponent
    ],
    templateUrl: './institution-dialog.component.html',
    styleUrl: './institution-dialog.component.scss'
})
export class InstitutionDialogComponent implements HasUnsavedChanges {
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);
    private dialogRef = inject<MatDialogRef<InstitutionDialogComponent, boolean>>(MatDialogRef);
    readonly data = inject<InstitutionDialogData>(MAT_DIALOG_DATA);

    readonly institution = this.data.institution;
    readonly accountCount = this.data.accountCount ?? 0;
    readonly isSaving = signal(false);

    readonly form = new FormGroup({
        name: new FormControl(this.institution?.name ?? '', {
            nonNullable: true,
            validators: [Validators.required, Validators.maxLength(100)]
        })
    });

    hasUnsavedChanges(): boolean {
        return this.form.dirty;
    }

    async save(): Promise<void> {
        if (this.form.invalid || this.isSaving()) {
            return;
        }

        this.isSaving.set(true);
        const name = this.form.controls.name.value.trim();
        const saved = this.institution
            ? await this.financeService.saveInstitution({ ...this.institution, name })
            : await this.financeService.createInstitution({ name });
        this.isSaving.set(false);

        if (saved) {
            this.notificationService.success(this.institution ? 'Institution saved' : 'Institution added');
            this.dialogRef.close(true);
        }
    }

    async delete(): Promise<void> {
        if (!this.institution || this.accountCount > 0) {
            return;
        }

        const confirmed = await this.modalService.confirm({
            title: 'Delete Institution',
            message: `Delete ${this.institution.name}? This can't be undone.`,
            confirmLabel: 'Delete',
            isWarn: true
        });
        if (confirmed && await this.financeService.deleteInstitution(this.institution.id)) {
            this.notificationService.success('Institution deleted');
            this.dialogRef.close(true);
        }
    }
}
