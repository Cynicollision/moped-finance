import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { NewEntity } from '@shared/core/types';
import { Account, Institution } from '@shared/finance/types';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { FinanceService } from './../finance.service';
import { AccountFormComponent } from './account-form.component';

// Add Account (ACCT-1.3), from the Institutions screen or, with ?institutionId=, from an institution's menu.
@Component({
    selector: 'app-finance-add-account',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterLink,
        MatButtonModule,
        AccountFormComponent,
        PageHeaderComponent
    ],
    templateUrl: './add-account.component.html',
    styleUrl: './add-account.component.scss'
})
export class FinanceAddAccountComponent implements OnInit {
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    readonly institutions = signal<Institution[] | null>(null);
    readonly institutionId = this.route.snapshot.queryParamMap.get('institutionId');

    async ngOnInit() {
        const institutions = await this.financeService.fetchInstitutions() ?? [];
        this.institutions.set(institutions.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })));
    }

    async onSave(accountData: Partial<Account>) {
        const newAccount: NewEntity<Account> = {
            institutionId: accountData.institutionId!,
            name: accountData.name!,
            category: accountData.category!,
            group: accountData.group!,
            type: accountData.type!,
            isHidden: accountData.isHidden ?? false,
            isManual: true,
            isRetirement: accountData.isRetirement ?? false,
            hideFromCashflow: accountData.hideFromCashflow ?? false
        };

        const created = await this.financeService.createAccount(newAccount);
        if (created) {
            this.router.navigate(['/accounts', created.id]);
        }
    }

    onCancel() {
        this.router.navigate(['/settings/institutions']);
    }
}
