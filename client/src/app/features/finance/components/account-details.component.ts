import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { GetAccountBalanceHistoryOptions, ProfileValueHistory } from '@shared/finance/contracts';
import { Account, BalanceHistory, Transaction, Category, Institution } from '@shared/finance/types';
import { FinanceService } from './../finance.service';
import { HistoryTimeframe, ValueHistoryType, AccountType, AccountCategory } from '@shared/finance/enum';
import { ValueHistoryComponent } from './value-history.component';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';

@Component({
    selector: 'app-finance-accounts',
    standalone: true,
    imports: [CommonModule, ValueHistoryComponent, RouterLink, MatTableModule, MatButtonModule, MatCardModule],
    templateUrl: './account-details.component.html',
    styleUrl: './account-details.component.scss'
})
export class FinanceAccountDetailsComponent implements OnInit {
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);

    account = signal<Account | undefined>(undefined);
    balanceHistory = signal<BalanceHistory[]>([]);
    transactions = signal<Transaction[]>([]);
    categoryMap = new Map<string, Category>();
    institutionMap = new Map<string, Institution>();

    selectedTimeframe = signal<HistoryTimeframe>(HistoryTimeframe.PastThirtyDays);
    displayedColumns: string[] = ['date', 'merchant', 'category', 'amount'];

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
            if (categories) {
                categories.forEach(c => this.categoryMap.set(c.id, c));
            }
            if (institutions) {
                institutions.forEach(i => this.institutionMap.set(i.id, i));
            }
            this.transactions.set(transactions || []);

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

    getCategoryName(id: string): string {
        const category = this.categoryMap.get(id);
        return category ? `${category.icon} ${category.name}` : id;
    }

    accountTypeDisplay = computed(() => {
        const acc = this.account();
        if (!acc) return '';
        return acc.type || acc.group;
    });

    institutionNameDisplay = computed(() => {
        const institutionId = this.account()?.institutionId;
        if (!institutionId) return '';
        return this.institutionMap.get(institutionId)?.name || institutionId;
    });
}
