import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Transaction } from '@shared/finance/types';
import { TransactionFormComponent } from './transaction-form.component';
import { FinanceService } from './../finance.service';
import { ModalService } from './../../core/modal/modal.service';

@Component({
    selector: 'app-finance-view-transaction',
    standalone: true,
    imports: [
        CommonModule,
        RouterLink,
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        TransactionFormComponent
    ],
    templateUrl: './view-transaction.component.html',
    styleUrl: './view-transaction.component.scss'
})
export class ViewTransactionComponent implements OnInit {
    private financeService = inject(FinanceService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private modalService = inject(ModalService);

    transactionId: string | null = null;
    readonly transaction = signal<Transaction | null>(null);

    async ngOnInit() {
        this.transactionId = this.route.snapshot.paramMap.get('transactionId');

        if (this.transactionId) {
            const transaction = await this.financeService.fetchTransaction(this.transactionId);
            if (transaction) {
                this.transaction.set(transaction);
            }
        }
    }

    onEdit() {
        if (this.transactionId) {
            this.router.navigate(['/transactions', this.transactionId, 'edit']);
        }
    }

    async deleteTransaction() {
        if (!this.transactionId) return;

        const confirmDelete = await this.modalService.confirm({
            title: 'Delete Transaction',
            message: 'Are you sure you want to delete this transaction?',
            confirmLabel: 'Delete',
            isWarn: true
        });

        if (confirmDelete) {
            const success = await this.financeService.deleteTransaction(this.transactionId);
            if (success) {
                this.router.navigate(['/transactions']);
            }
        }
    }
}