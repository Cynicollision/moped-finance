import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { Institution } from '@shared/finance/types';
import { FinanceService } from '../finance.service';

@Component({
    selector: 'app-finance-add-institution',
    standalone: true,
    imports: [
        CommonModule,
        ReactiveFormsModule,
        RouterLink,
        MatButtonModule,
        MatCardModule,
        MatFormFieldModule,
        MatInputModule,
        MatIconModule
    ],
    templateUrl: './add-institution.component.html',
    styleUrl: './add-institution.component.scss'
})
export class FinanceAddInstitutionComponent {
    private fb = inject(FormBuilder);
    private financeService = inject(FinanceService);
    private router = inject(Router);

    mode: 'selection' | 'manual' = 'selection';
    institutionForm: FormGroup;

    constructor() {
        this.institutionForm = this.fb.group({
            name: ['', Validators.required]
        });
    }

    setMode(mode: 'selection' | 'manual') {
        this.mode = mode;
    }

    async onSubmit() {
        if (this.institutionForm.valid) {

            // TODO: revisit
            const newInst: Institution = {
                id: '', // Server will generate or omit based on Entity
                userId: '', // Server will set
                name: this.institutionForm.value.name
            } as Institution;

            const created = await this.financeService.createInstitution(newInst);
            if (created) {
                this.router.navigate(['/institutions']);
            }
        }
    }
}
