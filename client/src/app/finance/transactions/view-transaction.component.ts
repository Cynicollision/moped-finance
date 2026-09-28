import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Transaction } from '@shared/finance/types';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { TransactionFormComponent } from './transaction-form.component';
import { FinanceService } from './../finance.service';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';

@Component({
    selector: 'app-finance-view-transaction',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatButtonModule,
        MatIconModule,
        MatMenuModule,
        TransactionFormComponent,
        PageHeaderComponent
    ],
    templateUrl: './view-transaction.component.html',
    styleUrl: './view-transaction.component.scss'
})
export class ViewTransactionComponent implements OnInit {
    private financeService = inject(FinanceService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);

    private transactionId: string | null = null;
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
        if (!this.transactionId) {
            return;
        }

        const confirmDelete = await this.modalService.confirm({
            title: 'Delete Transaction',
            message: "Delete this transaction? This can't be undone.",
            confirmLabel: 'Delete',
            isWarn: true
        });

        if (confirmDelete) {
            const success = await this.financeService.deleteTransaction(this.transactionId);
            if (success) {
                this.notificationService.success('Transaction deleted');
                this.router.navigate(['/transactions']);
            }
        }
    }
}
