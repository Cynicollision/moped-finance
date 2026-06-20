import { Component, EventEmitter, Input, Output, OnInit, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Institution } from '@shared/finance/types';

export type InstitutionFormMode = 'create' | 'edit' | 'readonly';

@Component({
    selector: 'app-institution-form',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule
    ],
    templateUrl: './institution-form.component.html',
    styleUrl: './institution-form.component.scss'
})
export class InstitutionFormComponent implements OnInit, OnChanges {
    @Input() institution: Institution | null = null;
    @Input() mode: InstitutionFormMode = 'readonly';
    @Output() save = new EventEmitter<Partial<Institution>>();
    @Output() cancel = new EventEmitter<void>();

    institutionForm = new FormGroup({
        name: new FormControl<string>('', { nonNullable: true, validators: [Validators.required] })
    });

    ngOnInit() {
        this.updateFormState();
    }

    ngOnChanges(changes: SimpleChanges) {
        if (changes['institution'] || changes['mode']) {
            this.updateFormState();
        }
    }

    private updateFormState() {
        if (this.institution) {
            this.institutionForm.patchValue({
                name: this.institution.name
            });
        } else if (this.mode === 'create') {
            this.institutionForm.reset({
                name: ''
            });
        }

        if (this.mode === 'readonly') {
            this.institutionForm.disable();
        } else {
            this.institutionForm.enable();
        }
    }

    onSave() {
        if (this.institutionForm.invalid) {
            return;
        }

        const formValue = this.institutionForm.getRawValue();

        const updatedInstitution: Partial<Institution> = {
            ...this.institution,
            name: formValue.name
        };

        this.save.emit(updatedInstitution);
    }

    onCancel() {
        this.cancel.emit();
    }
}
