
import { ChangeDetectionStrategy, Component, computed, inject, signal, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { TransactionImportResult } from '@shared/finance/contracts';
import { Account } from '@shared/finance/types';
import { Crumb, PageHeaderComponent } from './../../core/layout/page-header.component';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';

interface ImportErrors {
    message: string;
    rows: string[];
}

@Component({
    selector: 'app-import-transactions',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButtonModule, MatCardModule, MatIconModule, MatSnackBarModule, RouterModule, PageHeaderComponent],
    templateUrl: './import-transactions.component.html',
    styleUrl: './import-transactions.component.scss'
})
export class ImportTransactionsComponent implements OnInit {
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private notificationService = inject(NotificationService);

    readonly accountId = signal<string | null>(null);
    readonly account = signal<Account | null>(null);
    readonly selectedFile = signal<File | null>(null);
    readonly isProcessing = signal<boolean>(false);
    readonly dryRunResults = signal<TransactionImportResult | null>(null);
    /** The dry run's summary and each failed row's message (TXN-3.7, ACCT-3.7). */
    readonly validationError = signal<ImportErrors | null>(null);

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

    ngOnInit() {
        const id = this.route.snapshot.queryParamMap.get('accountId');
        if (id) {
            this.accountId.set(id);
            this.loadAccount(id);
        }
    }

    async loadAccount(id: string) {
        const acc = await this.financeService.fetchAccount(id);
        if (acc) {
            this.account.set(acc);
        }
    }

    onFileSelected(event: Event) {
        const file = (event.target as HTMLInputElement).files?.[0];
        if (file) {
            this.selectedFile.set(file);
            this.dryRunResults.set(null); // Reset results when a new file is chosen
            this.validationError.set(null);
        }
    }

    async validateImport() {
        const file = this.selectedFile();
        if (!file) {
            return;
        }

        this.isProcessing.set(true);
        const formData = new FormData();
        formData.append('file', file);

        this.validationError.set(null);
        const response = await this.financeService.importTransactions(formData, true, this.accountId());
        if (response) {
            if (response.isValidToImport) {
                this.dryRunResults.set(response);
            }
            else {
                this.validationError.set({
                    message: response.resultMessage || 'An unknown validation error occurred.',
                    rows: response.failedRowMessages
                });
            }
        }

        this.isProcessing.set(false);
    }

    async confirmImport() {
        const file = this.selectedFile();
        if (!file) {
            return;
        }

        this.isProcessing.set(true);
        const formData = new FormData();
        formData.append('file', file);

        this.validationError.set(null);
        const response = await this.financeService.importTransactions(formData, false, this.accountId());
        if (response) {
            if (response.isValidToImport) {
                this.notificationService.success(`Successfully created ${response.createdCount || 0} transactions.`);
                const id = this.accountId();
                if (id) {
                    this.router.navigate(['/accounts', id]);
                }
                else {
                    this.router.navigate(['/transactions']);
                }
            }
            else {
                this.validationError.set({
                    message: response.resultMessage || 'An unknown error occurred during import.',
                    rows: response.failedRowMessages
                });
            }
        }

        this.isProcessing.set(false);
    }

    cancelImport() {
        this.selectedFile.set(null);
        this.dryRunResults.set(null);
        this.validationError.set(null);
    }
}
