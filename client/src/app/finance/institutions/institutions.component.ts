import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Account, Institution } from '@shared/finance/types';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { ModalService } from './../../core/modal/modal.service';
import { FinanceService } from './../finance.service';
import { InstitutionDialogComponent, InstitutionDialogData } from './institution-dialog.component';

interface InstitutionGroup {
    institution: Institution;
    accounts: Account[];
}

@Component({
    selector: 'app-finance-institutions',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatMenuModule, PageHeaderComponent],
    templateUrl: './institutions.component.html',
    styleUrl: './institutions.component.scss'
})
export class FinanceInstitutionsComponent implements OnInit {
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);

    readonly institutions = signal<Institution[]>([]);
    readonly accounts = signal<Account[]>([]);

    readonly institutionGroups = computed<InstitutionGroup[]>(() => {
        const insts = this.institutions();
        const accs = this.accounts();

        return insts.map(inst => ({
            institution: inst,
            accounts: accs.filter(a => a.institutionId === inst.id)
        }));
    });

    async ngOnInit() {
        await this.load();
    }

    /** Add Institution, or edit an institution when given one (INST-1.4, INST-1.6). */
    async openInstitution(group?: InstitutionGroup) {
        const changed = await this.modalService.open<InstitutionDialogComponent, InstitutionDialogData, boolean>(
            InstitutionDialogComponent,
            { institution: group?.institution, accountCount: group?.accounts.length }
        );
        if (changed) {
            await this.load();
        }
    }

    private async load() {
        const [institutions, accounts] = await Promise.all([
            this.financeService.fetchInstitutions(),
            this.financeService.fetchAllAccounts()
        ]);

        if (institutions) {
            this.institutions.set(institutions);
        }

        if (accounts) {
            this.accounts.set(accounts);
        }
    }
}
