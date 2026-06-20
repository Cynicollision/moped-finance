import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Institution } from '@shared/finance/types';
import { InstitutionFormComponent } from './institution-form.component';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-view-institution',
    standalone: true,
    imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, MatMenuModule, InstitutionFormComponent],
    templateUrl: './view-institution.component.html',
    styleUrl: './view-institution.component.scss'
})
export class ViewInstitutionComponent implements OnInit {
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

    onEdit() {
        if (this.institutionId) {
            this.router.navigate(['/institutions', this.institutionId, 'edit']);
        }
    }

    async deleteInstitution() {
        if (!this.institutionId) return;

        const confirmDelete = confirm('Are you sure you want to delete this institution?');
        if (confirmDelete) {
            const success = await this.financeService.deleteInstitution(this.institutionId);
            if (success) {
                this.router.navigate(['/institutions']);
            }
        }
    }
}
