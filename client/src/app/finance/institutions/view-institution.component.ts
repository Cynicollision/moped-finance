import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Institution } from '@shared/finance/types';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { InstitutionFormComponent } from './institution-form.component';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-view-institution',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButtonModule, MatIconModule, MatMenuModule, InstitutionFormComponent, PageHeaderComponent],
    templateUrl: './view-institution.component.html',
    styleUrl: './view-institution.component.scss'
})
export class ViewInstitutionComponent implements OnInit {
    private financeService = inject(FinanceService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    private institutionId: string | null = null;
    readonly institution = signal<Institution | null>(null);

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
            this.router.navigate(['/settings/institutions', this.institutionId, 'edit']);
        }
    }
}
