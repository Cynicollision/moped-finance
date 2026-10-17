import { ChangeDetectionStrategy, Component, inject, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Account, Institution } from '@shared/finance/types';
import { PageHeaderComponent } from './../core/layout/page-header.component';
import { CardSkeletonComponent } from './../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { viewResource } from './../core/loading/view-resource';
import { ModalService } from './../core/modal/modal.service';
import { FinanceService } from './../common/finance.service';
import { InstitutionDialogComponent, InstitutionDialogData } from './institution-dialog.component';

interface InstitutionGroup {
    institution: Institution;
    accounts: Account[];
}

@Component({
    selector: 'app-institutions',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterLink,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatMenuModule,
        MatTooltipModule,
        PageHeaderComponent,
        CardSkeletonComponent,
        LoadErrorComponent
    ],
    templateUrl: './institutions.component.html',
    styleUrl: './institutions.component.scss'
})
export class InstitutionsComponent {
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);

    readonly data = viewResource({
        loader: async () => {
            const [institutions, accounts] = await Promise.all([
                this.financeService.fetchInstitutions(),
                this.financeService.fetchAllAccounts()
            ]);
            return { institutions, accounts };
        }
    });

    /** Undefined until loaded. */
    readonly institutionGroups = computed<InstitutionGroup[] | undefined>(() => {
        const data = this.data.value();
        return data?.institutions.map(institution => ({
            institution,
            accounts: data.accounts.filter(a => a.institutionId === institution.id)
        }));
    });

    /** Add Institution, or edit an institution when given one (INST-1.4, INST-1.6). */
    async openInstitution(group?: InstitutionGroup) {
        const changed = await this.modalService.open<InstitutionDialogComponent, InstitutionDialogData, boolean>(
            InstitutionDialogComponent,
            { institution: group?.institution, accountCount: group?.accounts.length }
        );
        if (changed) {
            this.data.reload();
        }
    }
}
