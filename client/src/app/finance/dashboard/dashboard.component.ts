import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DateProviderService } from './../../core/date-provider.service';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { RouterLink } from '@angular/router';
import { HistoryTimeframe } from '@shared/core/enum';
import { AccountGroup, ValueHistoryType } from '@shared/finance/enum';
import { Account } from '@shared/finance/types';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { CardSkeletonComponent } from './../../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../../core/loading/load-error.component';
import { viewResource } from './../../core/loading/view-resource';
import { FinanceValueHistoryComponent, TimeframeOptions } from './../common/value-history.component';
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
    selector: 'app-dashboard',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CurrencyPipe,
        MatCardModule,
        MatDividerModule,
        RouterLink,
        PageHeaderComponent,
        FinanceValueHistoryComponent,
        FinanceValuePeriodChangeComponent,
        CardSkeletonComponent,
        LoadErrorComponent
    ],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.scss'
})
export class DashboardComponent {
    private financeService = inject(FinanceService);
    private dateProvider = inject(DateProviderService);
    readonly Math = Math;

    // View State for Chart Options
    readonly selectedChartType = signal<ValueHistoryType>(ValueHistoryType.NetWorth);
    readonly selectedTimeframe = signal<HistoryTimeframe>(HistoryTimeframe.PastThirtyDays);

    readonly chartTypeOptions = [
        { value: ValueHistoryType.NetWorth, label: 'Net Worth' },
        { value: ValueHistoryType.Assets, label: 'Total Assets' },
        { value: ValueHistoryType.Liabilities, label: 'Total Liabilities' }
    ];

    readonly selectedTimeframeLabel = computed(() => {
        return TimeframeOptions.find(t => t.value === this.selectedTimeframe())?.label || 'Period';
    });

    readonly accounts = viewResource({ loader: () => this.financeService.fetchAllAccounts() });

    // The chart (DASH-1.1, DASH-1.2): reloads when the view type or timeframe changes, keeping the old chart
    // on screen meanwhile.
    readonly history = viewResource({
        params: () => ({ type: this.selectedChartType(), timeframe: this.selectedTimeframe() }),
        loader: ({ type, timeframe }) => this.financeService.fetchTotalValueHistory(type, timeframe)
    });

    // Each group's change over the timeframe (DASH-2.2), once the accounts are known.
    readonly groupChanges = viewResource({
        params: () => {
            const accounts = this.accounts.value();
            return accounts ? { accounts, timeframe: this.selectedTimeframe() } : undefined;
        },
        loader: ({ accounts, timeframe }) => this.loadGroupChanges(accounts, timeframe)
    });

    readonly groupPeriodChanges = computed(() => this.groupChanges.value() ?? new Map<AccountGroup, ValuePeriodChange>());

    readonly isRefreshing = computed(() =>
        this.accounts.isRefreshing() || this.history.isRefreshing() || this.groupChanges.isRefreshing());

    private async loadGroupChanges(accounts: Account[], timeframe: HistoryTimeframe): Promise<Map<AccountGroup, ValuePeriodChange>> {
        const asOfDate = this.dateProvider.today();
        const changes = new Map<AccountGroup, ValuePeriodChange>();
        const groupedAccounts = new Map<AccountGroup, Account[]>();

        for (const account of accounts) {
            const group = account.group;
            if (!groupedAccounts.has(group)) {
                groupedAccounts.set(group, []);
            }
            groupedAccounts.get(group)!.push(account);
        }

        // Groups load in parallel, like the accounts within each.
        await Promise.all([...groupedAccounts.entries()].map(async ([group, groupAccounts]) => {
            let startTotal = 0;
            let endTotal = 0;
            let hasData = false;

            await Promise.all(groupAccounts.map(async account => {
                const history = await this.financeService.fetchAccountBalanceHistory(account.id, { asOfDate, timeframe });
                if (history && history.length > 0) {
                    const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
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
        }));

        return changes;
    }

    onChartTypeChange(type: ValueHistoryType) {
        this.selectedChartType.set(type);
    }

    onTimeframeChange(timeframe: HistoryTimeframe) {
        this.selectedTimeframe.set(timeframe);
    }

    // The big number above the chart, for the chosen view type; undefined until the accounts load.
    readonly currentChartValue = computed(() => {
        if (!this.accounts.value()) {
            return undefined;
        }
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

        for (const account of this.accounts.value() ?? []) {
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
