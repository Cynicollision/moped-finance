import { CommonModule, Location } from '@angular/common';
import { Component, inject, signal, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Account } from '@shared/finance/types';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-import-transactions',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatSnackBarModule, RouterModule],
    templateUrl: './import-transactions.component.html',
    styleUrl: './import-transactions.component.scss'
})
export class ImportTransactionsComponent implements OnInit {
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private notificationService = inject(NotificationService);
    //private location = inject(Location);

    accountId = signal<string | null>(null);
    account = signal<Account | null>(null);
    selectedFile = signal<File | null>(null);
    isProcessing = signal<boolean>(false);
    dryRunResults = signal<any>(null);
    validationError = signal<string | null>(null);

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

    onFileSelected(event: any) {
        const file = event.target.files[0];
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
                const failureMessages = response.failedRowMessages || [];
                const failureCount = failureMessages.length;
                if (failureCount > 0) {
                    console.warn('Import Validation Failures:', failureMessages);
                }
            } else {
                this.validationError.set(response.resultMessage || 'An unknown validation error occurred.');
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
            } else {
                this.validationError.set(response.resultMessage || 'An unknown error occurred during import.');
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
