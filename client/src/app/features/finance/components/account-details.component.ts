import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { HistoryTimeframe } from '@shared/common/enum';
import { GetAccountBalanceHistoryOptions, TotalValueHistory } from '@shared/finance/contracts';
import { Account, BalanceHistory, Transaction, Category, Institution } from '@shared/finance/types';
import { ValueHistoryType, AccountCategory } from '@shared/finance/enum';
import { DateProviderService } from './../../../core/date-provider.service';
import { ModalService } from './../../../core/modal/modal.service';
import { FinanceService } from './../finance.service';
import { FinanceValueHistoryComponent } from './value-history.component';
import { FinanceAccountEditComponent } from './account-edit.component';

@Component({
    selector: 'app-finance-accounts',
    standalone: true,
    imports: [CommonModule, FinanceValueHistoryComponent, RouterLink, MatTableModule, MatButtonModule, MatCardModule, MatIconModule],
    templateUrl: './account-details.component.html',
    styleUrl: './account-details.component.scss'
})
export class FinanceAccountDetailsComponent implements OnInit {
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private modalService = inject(ModalService);
    private dateProvider = inject(DateProviderService);
    protected readonly Math = Math;

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
        const asOfDate = this.dateProvider.now();

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
    historyData = computed<TotalValueHistory[]>(() => {
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
        if (!acc) {
            return '';
        }

        let display: string = acc.type || acc.group;
        if (acc.isRetirement) {
            display += ' (Retirement)';
        }
        return display;
    });

    institutionNameDisplay = computed(() => {
        const institutionId = this.account()?.institutionId;
        if (!institutionId) {
            return '';
        }

        return this.institutionMap.get(institutionId)?.name || institutionId;
    });

    onRowClick(row: Transaction) {
        this.router.navigate(['/finance/transactions', row.id]);
    }

    async onEditAccount() {
        const currentAccount = this.account();
        if (!currentAccount) return;

        const result: any = await this.modalService.open(FinanceAccountEditComponent, {
            account: currentAccount
        });

        if (!result) {
            return;
        }

        if (result.action === 'save') {
            const updatedAccount = await this.financeService.saveAccount(result.account);
            if (updatedAccount) {
                this.account.set(updatedAccount);
            }
        }
        else if (result.action === 'delete') {
            const success = await this.financeService.deleteAccount(currentAccount.id);
            if (success) {
                this.router.navigate(['/finance']);
            }
        }
    }
}
