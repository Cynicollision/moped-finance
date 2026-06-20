import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Institution } from '@shared/finance/types';
import { InstitutionFormComponent } from './institution-form.component';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-edit-institution',
    standalone: true,
    imports: [CommonModule, RouterLink, InstitutionFormComponent],
    templateUrl: './edit-institution.component.html',
    styleUrl: './edit-institution.component.scss'
})
export class EditInstitutionComponent implements OnInit {
    private financeService = inject(FinanceService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    institutionId: string | null = null;
    institution = signal<Institution | null>(null);

    async ngOnInit() {
        this.institutionId = this.route.snapshot.paramMap.get('id');

        if (this.institutionId) {
            const institution = await this.financeService.fetchInstitution(this.institutionId);
            if (institution) {
                this.institution.set(institution);
            }
        }
    }

    async onSave(updatedInstitution: Partial<Institution>) {
        if (!this.institutionId) return;

        const success = await this.financeService.saveInstitution(updatedInstitution as Institution);
        if (success) {
            this.router.navigate(['/institutions', this.institutionId]);
        }
    }

    onCancel() {
        if (this.institutionId) {
            this.router.navigate(['/institutions', this.institutionId]);
        } else {
            this.router.navigate(['/institutions']);
        }
    }
}
