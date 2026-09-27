import { ChangeDetectionStrategy, Component, inject, computed, signal, OnInit } from '@angular/core';
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
import { FinanceValuePeriodChangeComponent, ValuePeriodChange } from './../common/value-period-change.component';
import { FinanceService } from './../finance.service';

/** One account group in the list, in display order. Liability groups show magnitudes, without the minus sign. */
interface AccountGroupSummary {
    group: AccountGroup;
    label: string;
    total: number;
    accounts: Account[];
    isLiability: boolean;
}

const groupOrder: { group: AccountGroup; label: string; isLiability: boolean }[] = [
    { group: AccountGroup.Cash, label: 'Cash', isLiability: false },
    { group: AccountGroup.Investment, label: 'Investments', isLiability: false },
    { group: AccountGroup.CreditCard, label: 'Credit Cards', isLiability: true },
    { group: AccountGroup.Loan, label: 'Loans', isLiability: true },
    { group: AccountGroup.RealEstate, label: 'Real Estate', isLiability: false }
];

@Component({
    selector: 'app-finance-summary',
    changeDetection: ChangeDetectionStrategy.OnPush,
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
    private financeService = inject(FinanceService);
    private dateProvider = inject(DateProviderService);
    readonly Math = Math;

    readonly accounts = signal<Account[]>([]);
    readonly groupPeriodChanges = signal<Map<AccountGroup, ValuePeriodChange>>(new Map());

    // Chart Data payload provided to the child `<app-value-history>` component
    readonly historyData = signal<TotalValueHistory[]>([]);

    // View State for Chart Options
    readonly selectedChartType = signal<ValueHistoryType>(ValueHistoryType.NetWorth);
    readonly selectedTimeframe = signal<HistoryTimeframe>(HistoryTimeframe.PastThirtyDays);

    readonly chartTypeOptions = [
        { value: ValueHistoryType.NetWorth, label: 'Net Worth' },
        { value: ValueHistoryType.Assets, label: 'Total Assets' },
        { value: ValueHistoryType.Liabilities, label: 'Total Liabilities' }
    ];

    readonly timeframeOptions = [
        { value: HistoryTimeframe.PastThirtyDays, label: 'Past 30 Days' },
        { value: HistoryTimeframe.PastSixtyDays, label: 'Past 60 Days' },
        { value: HistoryTimeframe.PastNinetyDays, label: 'Past 90 Days' },
        { value: HistoryTimeframe.PastOneYear, label: 'Past Year' },
        { value: HistoryTimeframe.PastTwoYears, label: 'Past 2 Years' },
        { value: HistoryTimeframe.YearToDate, label: 'Year To Date' },
        { value: HistoryTimeframe.All, label: 'All Time' }
    ];

    readonly selectedTimeframeLabel = computed(() => {
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
        if (accounts.length === 0) {
            return;
        }

        const changes = new Map<AccountGroup, ValuePeriodChange>();
        const groupedAccounts = new Map<AccountGroup, Account[]>();

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
    readonly currentChartValue = computed(() => {
        switch (this.selectedChartType()) {
            case ValueHistoryType.NetWorth:
                return this.summary().netWorth;
            case ValueHistoryType.Assets:
                return this.summary().totalAssets;
            case ValueHistoryType.Liabilities:
                return this.summary().totalLiabilities;
            default:
                return 0;
        }
    });

    readonly summary = computed(() => {
        const groups: AccountGroupSummary[] = groupOrder.map(g => ({ ...g, total: 0, accounts: [] }));
        const byGroup = new Map(groups.map(g => [g.group, g]));

        for (const account of this.accounts()) {
            const group = byGroup.get(account.group);
            if (group) {
                group.total += Number(account.balance) || 0;
                group.accounts.push(account);
            }
        }

        const total = (group: AccountGroup) => byGroup.get(group)!.total;
        const totalAssets = total(AccountGroup.Cash) + total(AccountGroup.Investment) + total(AccountGroup.RealEstate);
        const totalLiabilities = total(AccountGroup.CreditCard) + total(AccountGroup.Loan);

        return {
            netWorth: totalAssets - Math.abs(totalLiabilities),
            totalAssets,
            totalLiabilities,
            cash: total(AccountGroup.Cash),
            investments: total(AccountGroup.Investment),
            realEstate: total(AccountGroup.RealEstate),
            creditCards: total(AccountGroup.CreditCard),
            loans: total(AccountGroup.Loan),
            groups: groups.filter(g => g.accounts.length > 0)
        };
    });
}
