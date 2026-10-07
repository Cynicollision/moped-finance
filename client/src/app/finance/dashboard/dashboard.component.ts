import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { DateProviderService } from './../../core/date-provider.service';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { RouterLink } from '@angular/router';
import { HistoryTimeframe } from '@shared/core/enum';
import { AccountCategory, AccountGroup, ValueHistoryType } from '@shared/finance/enum';
import { Account } from '@shared/finance/types';
import { AccountTypeUtil } from '@shared/finance/util';
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
    total: number;
    /** By name, as the server sends them (DASH-2.1). */
    accounts: Account[];
    isLiability: boolean;
}

/** The Assets or Liabilities list: its groups, and its total at the bottom (DASH-2.1, DASH-2.5). */
interface AccountSection {
    title: string;
    groups: AccountGroupSummary[];
    total: number;
    isLiability: boolean;
}

@Component({
    selector: 'app-dashboard',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        CurrencyPipe,
        MatButtonModule,
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
    /** No accounts yet: the screen shows how to add one instead of an empty chart (DASH-1.8). */
    readonly hasNoAccounts = computed(() => this.accounts.value()?.length === 0);

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

    readonly groupPeriodChanges = computed(
        () => this.groupChanges.value() ?? new Map<AccountGroup, ValuePeriodChange>()
    );

    readonly isRefreshing = computed(
        () => this.accounts.isRefreshing() || this.history.isRefreshing() || this.groupChanges.isRefreshing()
    );

    // A group's change is the first and last days of its daily total, as the chart's is (DASH-2.2). Each account's
    // days run oldest first from the timeframe's start, or its first entry if later, to today, so the group's first
    // day is its accounts' earliest, and an account whose days start later adds nothing to it.
    private async loadGroupChanges(
        accounts: Account[],
        timeframe: HistoryTimeframe
    ): Promise<Map<AccountGroup, ValuePeriodChange>> {
        const asOfDate = this.dateProvider.today();
        const histories = await Promise.all(
            accounts.map(async account => ({
                group: account.group,
                days: await this.financeService.fetchAccountBalanceHistory(account.id, { asOfDate, timeframe })
            }))
        );

        const changes = new Map<AccountGroup, ValuePeriodChange>();
        for (const info of AccountTypeUtil.groups) {
            const series = histories.filter(h => h.group === info.group && h.days.length > 0).map(h => h.days);
            if (series.length === 0) {
                continue;
            }

            const firstDay = series.map(days => days[0].date).reduce((a, b) => (a < b ? a : b));
            const startTotal = series
                .filter(days => days[0].date === firstDay)
                .reduce((total, days) => total + days[0].balance, 0);
            const endTotal = series.reduce((total, days) => total + days[days.length - 1].balance, 0);

            const changeAmount = endTotal - startTotal;
            const changePercentage = startTotal !== 0 ? (changeAmount / Math.abs(startTotal)) * 100 : 0;

            let isPositive = changeAmount >= 0;
            let isGood = isPositive;

            if (info.category === AccountCategory.Liability) {
                isPositive = changeAmount < 0;
                isGood = !isPositive;
            }

            changes.set(info.group, {
                amount: Math.abs(changeAmount),
                percentage: Math.abs(changePercentage),
                isPositive,
                isGood
            });
        }

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

    // The groups in ACCT-1.2's order, leaving out those with no accounts (DASH-2.1), split into the Assets and
    // Liabilities sections with their totals (DASH-2.5). A section with no groups isn't shown.
    readonly summary = computed(() => {
        const groups: AccountGroupSummary[] = AccountTypeUtil.groups.map(info => ({
            group: info.group,
            total: 0,
            accounts: [],
            isLiability: info.category === AccountCategory.Liability
        }));
        const byGroup = new Map(groups.map(g => [g.group, g]));

        for (const account of this.accounts.value() ?? []) {
            const group = byGroup.get(account.group)!;
            group.total += Number(account.balance) || 0;
            group.accounts.push(account);
        }

        const shown = groups.filter(g => g.accounts.length > 0);
        const section = (title: string, isLiability: boolean): AccountSection => {
            const sectionGroups = shown.filter(g => g.isLiability === isLiability);
            return {
                title,
                groups: sectionGroups,
                total: sectionGroups.reduce((total, g) => total + g.total, 0),
                isLiability
            };
        };
        const assets = section('Assets', false);
        const liabilities = section('Liabilities', true);

        return {
            netWorth: assets.total - Math.abs(liabilities.total),
            totalAssets: assets.total,
            totalLiabilities: liabilities.total,
            sections: [assets, liabilities].filter(s => s.groups.length > 0)
        };
    });
}
