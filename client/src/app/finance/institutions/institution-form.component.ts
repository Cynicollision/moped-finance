import { ChangeDetectionStrategy, Component, OnInit, OnChanges, SimpleChanges, input, output } from '@angular/core';
import { ReactiveFormsModule, FormGroup, FormControl, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { Institution } from '@shared/finance/types';

export type InstitutionFormMode = 'create' | 'edit' | 'readonly';

@Component({
    selector: 'app-institution-form',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatButtonModule,
        MatFormFieldModule,
        MatInputModule
    ],
    templateUrl: './institution-form.component.html',
    styleUrl: './institution-form.component.scss'
})
export class InstitutionFormComponent implements OnInit, OnChanges {
    readonly institution = input<Institution | null>(null);
    readonly mode = input<InstitutionFormMode>('readonly');
    readonly save = output<Partial<Institution>>();
    readonly cancelled = output<void>();

    readonly institutionForm = new FormGroup({
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
        const institution = this.institution();
        const mode = this.mode();
        if (institution) {
            this.institutionForm.patchValue({
                name: institution.name
            });
        }
        else if (mode === 'create') {
            this.institutionForm.reset({
                name: ''
            });
        }

        if (mode === 'readonly') {
            this.institutionForm.disable();
        }
        else {
            this.institutionForm.enable();
        }
    }

    onSave() {
        if (this.institutionForm.invalid) {
            return;
        }

        const formValue = this.institutionForm.getRawValue();

        const updatedInstitution: Partial<Institution> = {
            ...this.institution(),
            name: formValue.name
        };

        this.save.emit(updatedInstitution);
    }

    onCancel() {
        this.cancelled.emit();
    }
}
