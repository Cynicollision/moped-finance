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
    private location = inject(Location);

    accountId = signal<string | null>(null);
    account = signal<Account | null>(null);
    selectedFile = signal<File | null>(null);
    isProcessing = signal<boolean>(false);
    dryRunResults = signal<any>(null);

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

        const response = await this.financeService.importTransactions(formData, true, this.accountId());
        if (response) {
            this.dryRunResults.set(response);
            this.notificationService.success('File validated successfully');
            if (response.failed?.length > 0) {
                console.warn('Import Validation Failures:', response.failed);
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

        const response = await this.financeService.importTransactions(formData, false, this.accountId());
        if (response) {
            this.notificationService.success(`Successfully created ${response.created || 0} and updated ${response.updated || 0} records.`);
            const id = this.accountId();
            if (id) {
                this.router.navigate(['/accounts', id]);
            }
            else {
                this.router.navigate(['/transactions']);
            }
        }

        this.isProcessing.set(false);
    }

    cancelImport() {
        this.selectedFile.set(null);
        this.dryRunResults.set(null);
    }
}
