import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { HistoryTimeframe } from '@shared/core/enum';
import { TotalValueHistory } from '@shared/finance/contracts';
import { Transaction } from '@shared/finance/types';
import { ValueHistoryType, AccountCategory } from '@shared/finance/enum';
import { PageHeaderComponent } from './../core/layout/page-header.component';
import { ListColumn, ListModule } from './../core/list/list.component';
import { DateProviderService } from './../core/date-provider.service';
import { CardSkeletonComponent } from './../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { viewResource } from './../core/loading/view-resource';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { categoryLabel } from './../common/category-label';
import { MoneyComponent } from './../common/money.component';
import { ValueHistoryComponent } from './../common/value-history.component';
import { FinanceService } from './../common/finance.service';
import { CloseAccountDialogComponent, CloseAccountDialogData } from './close-account-dialog.component';

@Component({
    selector: 'app-account-details',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        ValueHistoryComponent,
        RouterLink,
        MatButtonModule,
        MatCardModule,
        MatIconModule,
        MatMenuModule,
        MatDividerModule,
        PageHeaderComponent,
        CardSkeletonComponent,
        LoadErrorComponent,
        ListModule,
        MoneyComponent
    ],
    templateUrl: './account-details.component.html',
    styleUrl: './account-details.component.scss'
})
export class AccountDetailsComponent {
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private dateProvider = inject(DateProviderService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);

    private readonly accountId = this.route.snapshot.paramMap.get('accountId') ?? undefined;

    readonly selectedTimeframe = signal<HistoryTimeframe>(HistoryTimeframe.PastThirtyDays);
    // Narrow: merchant and amount, with the date and category under the merchant.
    readonly columns: ListColumn[] = [
        { key: 'date', label: 'Date', width: '8rem', compact: 'secondary' },
        { key: 'merchant', label: 'Merchant', width: 'minmax(0, 1.5fr)', compact: 'primary' },
        { key: 'category', label: 'Category', compact: 'secondary' },
        { key: 'amount', label: 'Amount', width: '9rem', align: 'end', compact: 'trailing' }
    ];

    readonly details = viewResource({
        params: () => this.accountId,
        loader: async accountId => {
            const [account, categories, institutions, transactions] = await Promise.all([
                this.financeService.fetchAccount(accountId),
                this.financeService.fetchCategories(false),
                this.financeService.fetchInstitutions(),
                this.financeService.fetchAccountRecentTransactions(accountId)
            ]);
            return { account, categories, institutions, transactions };
        }
    });

    // The chart reloads when the timeframe changes, keeping the old one on screen meanwhile (ACCT-2.4).
    readonly balances = viewResource({
        params: () => (this.accountId ? { accountId: this.accountId, timeframe: this.selectedTimeframe() } : undefined),
        loader: ({ accountId, timeframe }) =>
            this.financeService.fetchAccountBalanceHistory(accountId, {
                asOfDate: this.dateProvider.today(),
                timeframe
            })
    });

    readonly account = computed(() => this.details.value()?.account);
    readonly transactions = computed<Transaction[]>(() => this.details.value()?.transactions ?? []);
    private readonly categoryMap = computed(
        () => new Map((this.details.value()?.categories ?? []).map(c => [c.id, c]))
    );
    private readonly institutionMap = computed(
        () => new Map((this.details.value()?.institutions ?? []).map(i => [i.id, i]))
    );

    readonly isRefreshing = computed(() => this.details.isRefreshing() || this.balances.isRefreshing());

    onTimeframeChange(timeframe: HistoryTimeframe) {
        this.selectedTimeframe.set(timeframe);
    }

    // The balance history as the chart's points; undefined while it loads.
    readonly historyData = computed<TotalValueHistory[] | undefined>(() => {
        return this.balances.value()?.map(b => ({
            date: b.date,
            amount: b.balance,
            type: this.derivedChartType()
        }));
    });

    // Provide the chart with the layout context so that liability charts can invert the axis gracefully
    readonly derivedChartType = computed<ValueHistoryType>(() => {
        const category = this.account()?.category;
        if (category === AccountCategory.Liability) {
            return ValueHistoryType.Liabilities;
        }
        return ValueHistoryType.Assets;
    });

    readonly chartTypeOptions = computed(() => {
        const type = this.derivedChartType();
        return [
            {
                value: type,
                label: type === ValueHistoryType.Liabilities ? 'Total Liabilities' : 'Total Assets'
            }
        ];
    });

    getCategoryName(id: string): string {
        const category = this.categoryMap().get(id);
        return category ? categoryLabel(category) : id;
    }

    readonly institutionNameDisplay = computed(() => {
        const institutionId = this.account()?.institutionId;
        if (!institutionId) {
            return '';
        }

        return this.institutionMap().get(institutionId)?.name || institutionId;
    });

    downloadTransactions() {
        const accountId = this.account()?.id;
        if (accountId) {
            const url = this.financeService.getExportTransactionsUrl(accountId);
            window.open(url, '_blank');
        }
    }

    downloadBalanceHistory() {
        const accountId = this.account()?.id;
        if (accountId) {
            const url = this.financeService.getExportBalanceHistoryUrl(accountId);
            window.open(url, '_blank');
        }
    }

    async closeAccount() {
        const account = this.account();
        if (!account) {
            return;
        }

        const closed = await this.modalService.open<CloseAccountDialogComponent, CloseAccountDialogData, boolean>(
            CloseAccountDialogComponent,
            { account }
        );
        if (closed) {
            this.details.reload();
            this.balances.reload();
        }
    }

    async reopenAccount() {
        const account = this.account();
        if (account && (await this.financeService.reopenAccount(account.id))) {
            this.notificationService.success('Account reopened');
            this.details.reload();
        }
    }

    async deleteAccount() {
        const account = this.account();
        if (!account) {
            return;
        }

        // Closing keeps the account's past in the totals, so an open, unhidden one is pointed there first.
        const keepPast =
            account.closedOn || account.isHidden
                ? ''
                : ' To keep its past in your net worth and Spending, close it instead.';
        const confirmed = await this.modalService.confirm({
            title: 'Delete Account',
            message: `Delete ${account.name}, with its balance history and transactions? This can't be undone.${keepPast}`,
            confirmLabel: 'Delete',
            isWarn: true
        });
        if (confirmed && (await this.financeService.deleteAccount(account.id))) {
            this.notificationService.success('Account deleted');
            this.router.navigate(['/dashboard']);
        }
    }
}
