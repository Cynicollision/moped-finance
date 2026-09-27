import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { NewEntity } from '@shared/core/types';
import { Account, Institution } from '@shared/finance/types';
import { FinanceService } from './../finance.service';
import { AccountFormComponent } from './account-form.component';

@Component({
    selector: 'app-finance-add-account',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterLink,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        AccountFormComponent
    ],
    templateUrl: './add-account.component.html',
    styleUrl: './add-account.component.scss'
})
export class FinanceAddAccountComponent implements OnInit {
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);

    readonly mode = signal<'selection' | 'manual'>('selection');
    readonly institution = signal<Institution | undefined>(undefined);

    private institutionId?: string;

    async ngOnInit() {
        this.institutionId = this.route.snapshot.paramMap.get('id') || undefined;
        if (this.institutionId) {
            const institution = await this.financeService.fetchInstitution(this.institutionId);
            this.institution.set(institution);
            if (!institution) {
                this.router.navigate(['/institutions']);
                return;
            }
        }
        else {
            this.router.navigate(['/institutions']);
        }
    }

    async onSave(accountData: Partial<Account>) {
        if (this.institutionId) {
            const newAccount: NewEntity<Account> = {
                institutionId: this.institutionId,
                name: accountData.name!,
                category: accountData.category!,
                group: accountData.group!,
                type: accountData.type!,
                balance: accountData.balance || 0,
                isHidden: accountData.isHidden || false,
                isManual: accountData.isManual !== undefined ? accountData.isManual : true,
                isRetirement: accountData.isRetirement || false,
                hideFromCashflow: accountData.hideFromCashflow || false
            };

            const created = await this.financeService.createAccount(newAccount);
            if (created) {
                this.router.navigate(['/institutions']);
            }
        }
    }
}
