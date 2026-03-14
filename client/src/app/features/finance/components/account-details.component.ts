import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GetAccountBalanceHistoryOptions, ProfileValueHistory } from '@shared/finance/contracts';
import { Account, BalanceHistory } from '@shared/finance/types';
import { FinanceService } from './../finance.service';
import { HistoryTimeframe, ValueHistoryType, AccountType, AccountCategory } from '@shared/finance/enum';
import { ValueHistoryComponent } from './value-history.component';

@Component({
    selector: 'app-finance-accounts',
    standalone: true,
    imports: [CommonModule, ValueHistoryComponent, RouterLink],
    templateUrl: './account-details.component.html',
    styleUrl: './account-details.component.scss'
})
export class FinanceAccountDetailsComponent implements OnInit {
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);

    account = signal<Account | undefined>(undefined);
    balanceHistory = signal<BalanceHistory[]>([]);

    selectedTimeframe = signal<HistoryTimeframe>(HistoryTimeframe.PastThirtyDays);

    async ngOnInit() {
        const accountId = this.route.snapshot.paramMap.get('accountId');

        if (accountId) {
            const account = await this.financeService.fetchAccount(accountId);
            this.account.set(account);

            const transactions = await this.financeService.fetchAccountRecentTransactions(accountId)

            await this.updateChartData(accountId);
        }
    }

    async updateChartData(accountId: string) {
        const timeframe = this.selectedTimeframe();
        const asOfDate = new Date();

        const options: GetAccountBalanceHistoryOptions = {
            asOfDate,
            timeframe
        };

        const data = await this.financeService.fetchAccountBalanceHistory(accountId, options);
        this.balanceHistory.set(data || []);
    }

    onTimeframeChange(timeframe: HistoryTimeframe) {
        this.selectedTimeframe.set(timeframe);
        const accountId = this.account()?.id;
        if (accountId) {
            this.updateChartData(accountId);
        }
    }

    // Map the raw BalanceHistory to the generic ProfileValueHistory expected by ValueHistoryComponent
    historyData = computed<ProfileValueHistory[]>(() => {
        return this.balanceHistory().map(b => ({
            date: b.date,
            amount: b.balance,
            type: this.derivedChartType()
        }));
    });

    // Provide the chart with the layout context so that liability charts can invert the axis gracefully
    derivedChartType = computed<ValueHistoryType>(() => {
        const category = this.account()?.category;
        if (category === AccountCategory.Liability) {
            return ValueHistoryType.Liabilities;
        }
        return ValueHistoryType.Assets;
    });

    chartTypeOptions = computed(() => {
        const type = this.derivedChartType();
        return [{
            value: type,
            label: type === ValueHistoryType.Liabilities ? 'Total Liabilities' : 'Total Assets'
        }];
    });
}
