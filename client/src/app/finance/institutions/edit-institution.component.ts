import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Institution } from '@shared/finance/types';
import { InstitutionFormComponent } from './institution-form.component';
import { FinanceService } from './../finance.service';
import { ModalService } from './../../core/modal/modal.service';

@Component({
    selector: 'app-finance-edit-institution',
    standalone: true,
    imports: [CommonModule, RouterLink, MatButtonModule, MatIconModule, InstitutionFormComponent],
    templateUrl: './edit-institution.component.html',
    styleUrl: './edit-institution.component.scss'
})
export class EditInstitutionComponent implements OnInit {
    private financeService = inject(FinanceService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private modalService = inject(ModalService);

    institutionId: string | null = null;
    readonly institution = signal<Institution | null>(null);
    readonly associatedAccountsCount = signal<number | null>(null);

    async ngOnInit() {
        this.institutionId = this.route.snapshot.paramMap.get('id');

        if (this.institutionId) {
            const institution = await this.financeService.fetchInstitution(this.institutionId);
            if (institution) {
                this.institution.set(institution);
            }

            const accounts = await this.financeService.fetchInstitutionAccounts(this.institutionId);
            if (accounts) {
                this.associatedAccountsCount.set(accounts.length);
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

    async onDelete() {
        if (!this.institutionId || this.associatedAccountsCount() !== 0) return;

        const confirmDelete = await this.modalService.confirm({
            title: 'Delete Institution',
            message: 'Are you sure you want to delete this institution? There is no going back.',
            confirmLabel: 'Delete',
            isWarn: true
        });

        if (confirmDelete) {
            const success = await this.financeService.deleteInstitution(this.institutionId);
            if (success) {
                this.router.navigate(['/institutions']);
            }
        }
    }
}
