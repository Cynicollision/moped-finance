import { ChangeDetectionStrategy, Component, inject, computed, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
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
    /** The open ones, by name as the server sends them (DASH-2.1, DASH-2.10). */
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

    // Each group's change over the timeframe (DASH-2.2), worked out by the server from the group's daily totals.
    readonly groupChanges = viewResource({
        params: () => this.selectedTimeframe(),
        loader: timeframe => this.financeService.fetchAccountGroupChanges(timeframe)
    });

    readonly groupPeriodChanges = computed(() => {
        const changes = new Map<AccountGroup, ValuePeriodChange>();
        for (const { group, startAmount, endAmount } of this.groupChanges.value() ?? []) {
            const changeAmount = endAmount - startAmount;
            const changePercentage = startAmount !== 0 ? (changeAmount / Math.abs(startAmount)) * 100 : 0;

            let isPositive = changeAmount >= 0;
            let isGood = isPositive;

            // Debt shrinking toward zero is a down arrow, and good (DASH-1.3).
            if (AccountTypeUtil.groups.find(info => info.group === group)?.category === AccountCategory.Liability) {
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
        return changes;
    });

    readonly isRefreshing = computed(
        () => this.accounts.isRefreshing() || this.history.isRefreshing() || this.groupChanges.isRefreshing()
    );

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

        // Hidden accounts are left out of the lists and totals (DASH-2.9). Closed ones are left out of the lists, but
        // still count, so the totals match the chart (DASH-2.10, DASH-1.7).
        for (const account of (this.accounts.value() ?? []).filter(a => !a.isHidden)) {
            const group = byGroup.get(account.group)!;
            group.total += Number(account.balance) || 0;
            if (!account.closedOn) {
                group.accounts.push(account);
            }
        }

        const section = (title: string, isLiability: boolean): AccountSection => {
            const sectionGroups = groups.filter(g => g.isLiability === isLiability);
            return {
                title,
                groups: sectionGroups.filter(g => g.accounts.length > 0),
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
