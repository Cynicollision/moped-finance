import { CommonModule } from '@angular/common';
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
    selector: 'app-balance-import',
    standalone: true,
    imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatSnackBarModule, RouterModule],
    templateUrl: './balance-import.component.html',
    styleUrl: './balance-import.component.scss'
})
export class BalanceImportComponent implements OnInit {
    private financeService = inject(FinanceService);
    private route = inject(ActivatedRoute);
    private router = inject(Router);
    private notificationService = inject(NotificationService);

    readonly accountId = signal<string | null>(null);
    readonly account = signal<Account | null>(null);
    readonly selectedFile = signal<File | null>(null);
    readonly isProcessing = signal<boolean>(false);
    readonly dryRunResults = signal<any>(null);
    readonly validationError = signal<string | null>(null);

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('accountId');
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
        const id = this.accountId();
        if (!file || !id) {
            return;
        }

        this.isProcessing.set(true);
        const formData = new FormData();
        formData.append('file', file);

        this.validationError.set(null);
        const response = await this.financeService.importBalanceHistory(id, formData, true);
        if (response) {
            if (response.isValidToImport) {
                this.dryRunResults.set(response);
            } else {
                this.validationError.set(response.resultMessage || 'An unknown validation error occurred.');
            }
        }

        this.isProcessing.set(false);
    }

    async confirmImport() {
        const file = this.selectedFile();
        const id = this.accountId();
        if (!file || !id) {
            return;
        }

        this.isProcessing.set(true);
        const formData = new FormData();
        formData.append('file', file);

        this.validationError.set(null);
        const response = await this.financeService.importBalanceHistory(id, formData, false);
        if (response) {
            if (response.isValidToImport) {
                this.notificationService.success(`Successfully imported ${response.createdCount || 0} records.`);
                this.router.navigate(['/accounts', id]);
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
