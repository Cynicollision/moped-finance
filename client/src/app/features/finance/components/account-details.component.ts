import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { GetAccountBalanceHistoryOptions } from '@shared/finance/contracts';
import { Account, BalanceHistory } from '@shared/finance/types';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-accounts',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './account-details.component.html'
})
export class FinanceAccountDetailsComponent implements OnInit {
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);

    account: Account | undefined;
    balanceHistory: BalanceHistory[] = [];

    async ngOnInit() {
        const accountId = this.route.snapshot.paramMap.get('accountId');

        if (accountId) {
            this.account = await this.financeService.fetchAccount(accountId);

            const endDate = new Date();
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);

            const options: GetAccountBalanceHistoryOptions = {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
            };

            this.balanceHistory = await this.financeService.fetchAccountBalanceHistory(accountId, options) || [];
        }
    }
}
