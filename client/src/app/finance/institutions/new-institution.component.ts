import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NewEntity } from '@shared/core/types';
import { Institution } from '@shared/finance/types';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { InstitutionFormComponent } from './institution-form.component';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-new-institution',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [InstitutionFormComponent, PageHeaderComponent],
    templateUrl: './new-institution.component.html',
    styleUrl: './new-institution.component.scss'
})
export class NewInstitutionComponent {
    private financeService = inject(FinanceService);
    private router = inject(Router);

    async onSave(institution: Partial<Institution>) {
        const newInst: NewEntity<Institution> = {
            name: institution.name!
        };

        const created = await this.financeService.createInstitution(newInst);
        if (created) {
            this.router.navigate(['/settings/institutions']);
        }
    }

    onCancel() {
        this.router.navigate(['/settings/institutions']);
    }
}
