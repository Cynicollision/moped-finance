import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Account, Institution } from '@shared/finance/types';
import { FinanceService } from './../finance.service';

interface InstitutionGroup {
    institution: Institution;
    accounts: Account[];
}

@Component({
    selector: 'app-finance-institutions',
    standalone: true,
    imports: [CommonModule, RouterLink, MatButtonModule, MatCardModule, MatIconModule, MatMenuModule],
    templateUrl: './institutions.component.html',
    styleUrl: './institutions.component.scss'
})
export class FinanceInstitutionsComponent implements OnInit {
    private financeService = inject(FinanceService);

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
