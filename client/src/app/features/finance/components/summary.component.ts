import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { RouterLink } from '@angular/router';
import { HistoryTimeframe } from '@shared/common/enum';
import { TotalValueHistory } from '@shared/finance/contracts';
import { AccountGroup, ValueHistoryType } from '@shared/finance/enum';
import { Account } from '@shared/finance/types';
import { FinanceService } from './../finance.service';
import { FinanceValueHistoryComponent } from './value-history.component';

@Component({
    selector: 'app-finance-summary',
    standalone: true,
    imports: [
        CurrencyPipe,
        MatCardModule,
        MatDividerModule,
        RouterLink,
        FinanceValueHistoryComponent
    ],
    templateUrl: './summary.component.html',
    styleUrl: './summary.component.scss'
})
export class FinanceSummaryComponent implements OnInit {
    financeService = inject(FinanceService);

    accounts = signal<Account[]>([]);

    // Chart Data payload provided to the child `<app-value-history>` component
    historyData = signal<TotalValueHistory[]>([]);

    // View State for Chart Options
    selectedChartType = signal<ValueHistoryType>(ValueHistoryType.NetWorth);
    selectedTimeframe = signal<HistoryTimeframe>(HistoryTimeframe.PastThirtyDays);

    chartTypeOptions = [
        { value: ValueHistoryType.NetWorth, label: 'Net Worth' },
        { value: ValueHistoryType.Assets, label: 'Total Assets' },
        { value: ValueHistoryType.Liabilities, label: 'Total Liabilities' }
    ];

    async ngOnInit() {
        this.accounts.set(await this.financeService.fetchAllAccounts() || []);
        await this.updateChartData();
    }

    async updateChartData() {
        const data = await this.financeService.fetchTotalValueHistory(
            this.selectedChartType(),
            this.selectedTimeframe()
        );

        this.historyData.set(data || []);
    }

    // Event Handler passed from the child component up
    onChartTypeChange(type: ValueHistoryType) {
        this.selectedChartType.set(type);
        this.updateChartData();
    }

    // Event Handler passed from the child component up
    onTimeframeChange(timeframe: HistoryTimeframe) {
        this.selectedTimeframe.set(timeframe);
        this.updateChartData();
    }

    // Dynamic Summary value to hand down dependent on chart viewing mode
    currentChartValue = computed(() => {
        if (this.selectedChartType() === ValueHistoryType.NetWorth) return this.summary().netWorth;
        if (this.selectedChartType() === ValueHistoryType.Assets) return this.summary().totalAssets;
        if (this.selectedChartType() === ValueHistoryType.Liabilities) return this.summary().totalLiabilities;
        return 0;
    });

    summary = computed(() => {
        const cashAccounts: any[] = [];
        const investmentAccounts: any[] = [];
        const realEstateAccounts: any[] = [];
        const creditCardAccounts: any[] = [];
        const loanAccounts: any[] = [];

        let cashTotal = 0;
        let investmentsTotal = 0;
        let realEstateTotal = 0;
        let creditCardsTotal = 0;
        let loansTotal = 0;

        for (const account of this.accounts()) {
            const balance = Number(account.balance) || 0;
            const group = (account.group || '');

            if (group === AccountGroup.Cash) {
                cashTotal += balance;
                cashAccounts.push(account);
            }
            else if (group === AccountGroup.Investment) {
                investmentsTotal += balance;
                investmentAccounts.push(account);
            }
            else if (group === AccountGroup.RealEstate) {
                realEstateTotal += balance;
                realEstateAccounts.push(account);
            }
            else if (group === AccountGroup.CreditCard) {
                creditCardsTotal += balance;
                creditCardAccounts.push(account);
            }
            else if (group === AccountGroup.Loan) {
                loansTotal += balance;
                loanAccounts.push(account);
            }
        }

        const totalAssets = cashTotal + investmentsTotal + realEstateTotal;
        const totalLiabilities = creditCardsTotal + loansTotal;

        return {
            netWorth: totalAssets - totalLiabilities,
            totalAssets,
            totalLiabilities,
            cash: cashTotal,
            investments: investmentsTotal,
            realEstate: realEstateTotal,
            creditCards: creditCardsTotal,
            loans: loansTotal,
            cashAccounts,
            investmentAccounts,
            realEstateAccounts,
            creditCardAccounts,
            loanAccounts
        };
    });
}