import { ChangeDetectionStrategy, Component, OnInit, inject, signal, computed } from '@angular/core';
import { CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { HistoryTimeframe } from '@shared/core/enum';
import { GetAccountBalanceHistoryOptions, TotalValueHistory } from '@shared/finance/contracts';
import { Account, BalanceHistory, Transaction, Category, Institution } from '@shared/finance/types';
import { ValueHistoryType, AccountCategory } from '@shared/finance/enum';
import { DateProviderService } from './../../core/date-provider.service';
import { FinanceValueHistoryComponent } from './../common/value-history.component';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-accounts',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [CurrencyPipe, DatePipe, FinanceValueHistoryComponent, RouterLink, MatTableModule, MatButtonModule, MatCardModule, MatIconModule, MatMenuModule, MatDividerModule],
    templateUrl: './account-details.component.html',
    styleUrl: './account-details.component.scss'
})
export class FinanceAccountDetailsComponent implements OnInit {
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private dateProvider = inject(DateProviderService);
    readonly Math = Math;

    readonly account = signal<Account | undefined>(undefined);
    readonly balanceHistory = signal<BalanceHistory[]>([]);
    readonly transactions = signal<Transaction[]>([]);
    private readonly categoryMap = signal(new Map<string, Category>());
    private readonly institutionMap = signal(new Map<string, Institution>());

    readonly selectedTimeframe = signal<HistoryTimeframe>(HistoryTimeframe.PastThirtyDays);
    readonly displayedColumns: string[] = ['date', 'merchant', 'category', 'amount'];

    async ngOnInit() {
        const accountId = this.route.snapshot.paramMap.get('accountId');

        if (accountId) {
            const [account, categories, institutions, transactions] = await Promise.all([
                this.financeService.fetchAccount(accountId),
                this.financeService.fetchCategories(false),
                this.financeService.fetchInstitutions(),
                this.financeService.fetchAccountRecentTransactions(accountId)
            ]);

            this.account.set(account);
            this.categoryMap.set(new Map((categories || []).map(c => [c.id, c])));
            this.institutionMap.set(new Map((institutions || []).map(i => [i.id, i])));
            this.transactions.set(transactions || []);

            await this.updateChartData(accountId);
        }
    }

    async updateChartData(accountId: string) {
        const timeframe = this.selectedTimeframe();
        const asOfDate = this.dateProvider.today();

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

    // Map the raw BalanceHistory to the generic TotalValueHistory expected by ValueHistoryComponent
    readonly historyData = computed<TotalValueHistory[]>(() => {
        return this.balanceHistory().map(b => ({
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
        return [{
            value: type,
            label: type === ValueHistoryType.Liabilities ? 'Total Liabilities' : 'Total Assets'
        }];
    });

    getCategoryName(id: string): string {
        const category = this.categoryMap().get(id);
        return category ? `${category.icon} ${category.name}` : id;
    }

    readonly accountTypeDisplay = computed(() => {
        const acc = this.account();
        if (!acc) {
            return '';
        }

        let display: string = acc.type || acc.group;
        if (acc.isRetirement) {
            display += ' (Retirement)';
        }
        return display;
    });

    readonly institutionNameDisplay = computed(() => {
        const institutionId = this.account()?.institutionId;
        if (!institutionId) {
            return '';
        }

        return this.institutionMap().get(institutionId)?.name || institutionId;
    });

    onRowClick(row: Transaction) {
        this.router.navigate(['/transactions', row.id]);
    }

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
}
