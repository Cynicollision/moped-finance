import { ChangeDetectionStrategy, Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Transaction } from '@shared/finance/types';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { NotificationService } from './../../core/notification.service';
import { HasUnsavedChanges } from './../../core/unsaved-changes';
import { TransactionFormComponent } from './transaction-form.component';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-edit-transaction',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TransactionFormComponent, PageHeaderComponent],
    templateUrl: './edit-transaction.component.html',
    styleUrl: './edit-transaction.component.scss'
})
export class EditTransactionComponent implements OnInit, HasUnsavedChanges {
    private financeService = inject(FinanceService);
    private notificationService = inject(NotificationService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    protected transactionId: string | null = null;
    readonly transaction = signal<Transaction | null>(null);

    private readonly form = viewChild(TransactionFormComponent);
    private saved = false;

    async ngOnInit() {
        this.transactionId = this.route.snapshot.paramMap.get('transactionId');

        if (this.transactionId) {
            const transaction = await this.financeService.fetchTransaction(this.transactionId);
            if (transaction) {
                this.transaction.set(transaction);
            }
        }
    }

    hasUnsavedChanges(): boolean {
        return !this.saved && (this.form()?.hasUnsavedChanges() ?? false);
    }

    async onSave(updatedTransaction: Partial<Transaction>) {
        if (!this.transactionId) {
            return;
        }

        const success = await this.financeService.saveTransaction(updatedTransaction as Transaction);
        if (success) {
            this.saved = true;
            this.notificationService.success('Transaction saved');
            this.router.navigate(['/transactions', this.transactionId]);
        }
    }

    onCancel() {
        if (this.transactionId) {
            this.router.navigate(['/transactions', this.transactionId]);
        }
        else {
            this.router.navigate(['/transactions']);
        }
    }
}
