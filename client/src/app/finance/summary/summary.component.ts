import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DateProviderService } from './../../core/date-provider.service';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { RouterLink } from '@angular/router';
import { HistoryTimeframe } from '@shared/core/enum';
import { TotalValueHistory } from '@shared/finance/contracts';
import { AccountGroup, ValueHistoryType } from '@shared/finance/enum';
import { Account } from '@shared/finance/types';
import { FinanceValueHistoryComponent } from './../common/value-history.component';
import { FinanceValuePeriodChangeComponent } from './../common/value-period-change.component';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-summary',
    standalone: true,
    imports: [
        CurrencyPipe,
        MatCardModule,
        MatDividerModule,
        RouterLink,
        FinanceValueHistoryComponent,
        FinanceValuePeriodChangeComponent
    ],
    templateUrl: './summary.component.html',
    styleUrl: './summary.component.scss'
})
export class FinanceSummaryComponent implements OnInit {
    financeService = inject(FinanceService);
    dateProvider = inject(DateProviderService);
    protected readonly Math = Math;
    protected readonly AccountGroup = AccountGroup;

    accounts = signal<Account[]>([]);
    groupPeriodChanges = signal<Map<string, any>>(new Map());

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

    timeframeOptions = [
        { value: HistoryTimeframe.PastThirtyDays, label: 'Past 30 Days' },
        { value: HistoryTimeframe.PastSixtyDays, label: 'Past 60 Days' },
        { value: HistoryTimeframe.PastNinetyDays, label: 'Past 90 Days' },
        { value: HistoryTimeframe.PastOneYear, label: 'Past Year' },
        { value: HistoryTimeframe.PastTwoYears, label: 'Past 2 Years' },
        { value: HistoryTimeframe.YearToDate, label: 'Year To Date' },
        { value: HistoryTimeframe.All, label: 'All Time' }
    ];

    selectedTimeframeLabel = computed(() => {
        return this.timeframeOptions.find(t => t.value === this.selectedTimeframe())?.label || 'Period';
    });

    async ngOnInit() {
        this.accounts.set(await this.financeService.fetchAllAccounts() || []);
        await this.updateChartData();
        await this.updateGroupPeriodChanges();
    }

    async updateGroupPeriodChanges() {
        const timeframe = this.selectedTimeframe();
        const asOfDate = this.dateProvider.now();

        const accounts = this.accounts();
        if (accounts.length === 0) return;

        const changes = new Map<string, any>();
        const groupedAccounts = new Map<string, Account[]>();

        for (const account of accounts) {
            const group = account.group;
            if (!groupedAccounts.has(group)) {
                groupedAccounts.set(group, []);
            }
            groupedAccounts.get(group)!.push(account);
        }

        for (const [group, groupAccounts] of groupedAccounts.entries()) {
            let startTotal = 0;
            let endTotal = 0;
            let hasData = false;

            await Promise.all(groupAccounts.map(async account => {
                const history = await this.financeService.fetchAccountBalanceHistory(account.id, { asOfDate, timeframe });
                if (history && history.length > 0) {
                    const sorted = [...history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
                    startTotal += Number(sorted[0].balance);
                    endTotal += Number(sorted[sorted.length - 1].balance);
                    hasData = true;
                }
            }));

            if (hasData) {
                const changeAmount = endTotal - startTotal;
                const changePercentage = startTotal !== 0 ? (changeAmount / Math.abs(startTotal)) * 100 : 0;

                let isPositive = changeAmount >= 0;
                let isGood = isPositive;

                if (group === AccountGroup.CreditCard || group === AccountGroup.Loan) {
                    isPositive = changeAmount < 0;
                    isGood = !isPositive;
                }

                changes.set(group, {
                    amount: Math.abs(changeAmount),
                    percentage: Math.abs(changePercentage),
                    isPositive,
                    isGood
                });
            }
        }

        this.groupPeriodChanges.set(changes);
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
        this.updateGroupPeriodChanges();
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
            netWorth: totalAssets - Math.abs(totalLiabilities),
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