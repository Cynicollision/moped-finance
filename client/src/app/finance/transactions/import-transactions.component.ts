import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { ActivatedRoute, Router } from '@angular/router';
import { TransactionImportResult } from '@shared/finance/contracts';
import { CsvImportComponent } from './../../core/import/csv-import.component';
import { Crumb, PageHeaderComponent } from './../../core/layout/page-header.component';
import { viewResource } from './../../core/loading/view-resource';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-import-transactions',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatCardModule, MatCheckboxModule, MatIconModule, CsvImportComponent, PageHeaderComponent],
    templateUrl: './import-transactions.component.html',
    styleUrl: './import-transactions.component.scss'
})
export class ImportTransactionsComponent {
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private notificationService = inject(NotificationService);

    readonly accountId = signal(this.route.snapshot.queryParamMap.get('accountId'));
    // Only names the account in the breadcrumb, which says "Account" until then or if it fails.
    private readonly accountData = viewResource({
        params: () => this.accountId() ?? undefined,
        loader: id => this.financeService.fetchAccount(id)
    });
    readonly account = computed(() => this.accountData.value() ?? null);
    /** Offered for an import into an open manual account, and off by default (TXN-3.11). */
    readonly canAdjustBalances = computed(() => {
        const account = this.account();
        return !!account?.isManual && !account.closedOn;
    });
    readonly adjustBalances = signal(false);

    // Opened from an account's menu, the screen sits below that account; otherwise below Transactions.
    readonly crumbs = computed<Crumb[]>(() => {
        const accountId = this.accountId();
        if (!accountId) {
            return [{ label: 'Transactions', link: '/transactions' }];
        }
        return [
            { label: 'Dashboard', link: '/dashboard' },
            { label: this.account()?.name ?? 'Account', link: ['/accounts', accountId] }
        ];
    });

    readonly runImport = (form: FormData, dryRun: boolean) =>
        this.financeService.importTransactions(
            form,
            dryRun,
            this.accountId(),
            this.canAdjustBalances() && this.adjustBalances()
        );

    onImported(result: TransactionImportResult) {
        const skipped = result.duplicateCount > 0 ? ` Skipped ${result.duplicateCount} already imported.` : '';
        this.notificationService.success(`Successfully created ${result.createdCount} transactions.${skipped}`);
        const id = this.accountId();
        this.router.navigate(id ? ['/accounts', id] : ['/transactions']);
    }

    /** The rows that use an unmatched category name: "row 4", "rows 4, 9", or the first ten "and 3 more". */
    rowsText(rowNumbers: number[]): string {
        const shown = rowNumbers.slice(0, 10).join(', ');
        const more = rowNumbers.length > 10 ? ` and ${rowNumbers.length - 10} more` : '';
        return `${rowNumbers.length === 1 ? 'row' : 'rows'} ${shown}${more}`;
    }
}
