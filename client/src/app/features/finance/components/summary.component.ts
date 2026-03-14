import { Component, inject, computed, signal, OnInit } from '@angular/core';
import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { ProfileValueHistory } from '@shared/finance/contracts';
import { AccountType, HistoryTimeframe, ValueHistoryType } from '@shared/finance/enum';
import { Account } from '@shared/finance/types';
import { FinanceService } from './../finance.service';
import { ChartComponent, ChartConfiguration } from './../../../core/chart.component';

@Component({
    selector: 'app-finance-summary',
    standalone: true,
    imports: [
        CurrencyPipe,
        DecimalPipe,
        MatCardModule,
        MatDividerModule,
        RouterLink,
        ChartComponent,
        MatFormFieldModule,
        MatSelectModule,
        MatIconModule
    ],
    templateUrl: './summary.component.html',
    styleUrl: './summary.component.scss'
})
export class FinanceSummaryComponent implements OnInit {
    financeService = inject(FinanceService);

    accounts = signal<Account[]>([]);

    // Chart configuration loaded via API
    netWorthChartConfig: ChartConfiguration | undefined;

    // View State for Chart Options
    selectedChartType = signal<ValueHistoryType>(ValueHistoryType.NetWorth);
    selectedTimeframe = signal<HistoryTimeframe>(HistoryTimeframe.PastThirtyDays);

    periodChange = signal<{
        amount: number;
        percentage: number;
        isPositive: boolean;
        isGood: boolean;
        timeframeLabel: string;
    } | undefined>(undefined);

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
        { value: HistoryTimeframe.All, label: 'All Time' }
    ];

    selectedChartLabel = computed(() => {
        return this.chartTypeOptions.find(o => o.value === this.selectedChartType())?.label || 'Net Worth';
    });

    async ngOnInit() {
        this.accounts.set(await this.financeService.fetchAccounts() || []);
        await this.updateChartData();
    }

    async updateChartData() {
        const historyData = await this.financeService.fetchProfileValueHistory(
            this.selectedChartType(),
            this.selectedTimeframe()
        );

        if (historyData && historyData.length > 0) {
            this.netWorthChartConfig = this.buildNetWorthChartConfig(historyData);
            this.calculatePeriodChange(historyData);
        } else {
            this.netWorthChartConfig = undefined;
            this.periodChange.set(undefined);
        }
    }

    private calculatePeriodChange(historyData: ProfileValueHistory[]) {
        if (historyData.length < 2) {
            this.periodChange.set(undefined);
            return;
        }

        // historyData comes sorted from the API by default, but double check first/last
        const sortedData = [...historyData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const startValue = sortedData[0].amount;
        const endValue = sortedData[sortedData.length - 1].amount;

        // Base case: check the raw numeric difference
        const changeAmount = endValue - startValue;
        const changePercentage = startValue !== 0 ? (changeAmount / Math.abs(startValue)) * 100 : 0;

        let isPositive = changeAmount >= 0;
        let isGood = isPositive;

        if (this.selectedChartType() === ValueHistoryType.Liabilities) {
            // Liabilities are stored as negative numbers (or we are evaluating their absolute magnitude).
            // A decrease towards 0 means the numeric value is technically INCREASING (e.g., -5000 to -1000).
            // However, the user expects to see:
            // - Debt shrinking towards $0: DOWN arrow (isPositive = false) AND Green (isGood = true)
            // - Debt growing away from $0: UP arrow (isPositive = true) AND Red (isGood = false)
            
            // To achieve this, if the numeric value INCREASES (debt shrinks), the arrow goes DOWN.
            isPositive = changeAmount < 0; 
            isGood = !isPositive; 
        }

        const timeframeLabel = this.timeframeOptions.find(t => t.value === this.selectedTimeframe())?.label || 'Period';

        this.periodChange.set({
            amount: Math.abs(changeAmount), // Absolute value for display (- is handled by arrow/positivity)
            percentage: Math.abs(changePercentage),
            isPositive,
            isGood,
            timeframeLabel
        });
    }

    private buildNetWorthChartConfig(historyData: ProfileValueHistory[]): ChartConfiguration {
        // Sort ascending by date for the chart (left to right)
        const ascendingData = [...historyData].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        return {
            type: 'line',
            data: {
                labels: ascendingData.map(d => {
                    const date = new Date(d.date);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                }),
                datasets: [
                    {
                        label: this.chartTypeOptions.find(o => o.value === this.selectedChartType())?.label || 'Value',
                        data: ascendingData.map(d => d.amount),
                        borderColor: '#4caf50',
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        fill: true,
                        tension: 0.1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        reverse: this.selectedChartType() === ValueHistoryType.Liabilities,
                        ticks: {
                            callback: function (value) {
                                return '$' + Number(value).toLocaleString();
                            }
                        }
                    }
                }
            }
        };
    }

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
            const type = (account.type || '');

            if (type === AccountType.Cash) {
                cashTotal += balance;
                cashAccounts.push(account);
            }
            else if (type === AccountType.Investment) {
                investmentsTotal += balance;
                investmentAccounts.push(account);
            }
            else if (type === AccountType.RealEstate) {
                realEstateTotal += balance;
                realEstateAccounts.push(account);
            }
            else if (type === AccountType.CreditCard) {
                creditCardsTotal += balance;
                creditCardAccounts.push(account);
            }
            else if (type === AccountType.Loan) {
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