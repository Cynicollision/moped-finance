import { ChangeDetectionStrategy, Component, inject, viewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { NewEntity } from '@shared/core/types';
import { Transaction } from '@shared/finance/types';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { NotificationService } from './../../core/notification.service';
import { HasUnsavedChanges } from './../../core/unsaved-changes';
import { TransactionFormComponent } from './transaction-form.component';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-add-transaction',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TransactionFormComponent, PageHeaderComponent],
    templateUrl: './add-transaction.component.html',
    styleUrl: './add-transaction.component.scss'
})
export class AddTransactionComponent implements HasUnsavedChanges {
    private financeService = inject(FinanceService);
    private notificationService = inject(NotificationService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    readonly defaultAccountId = this.route.snapshot.queryParamMap.get('accountId') || undefined;

    private readonly form = viewChild(TransactionFormComponent);
    private saved = false;

    hasUnsavedChanges(): boolean {
        return !this.saved && (this.form()?.hasUnsavedChanges() ?? false);
    }

    async onSave(transaction: Partial<Transaction>) {
        const newTransaction: NewEntity<Transaction> = {
            accountId: transaction.accountId!,
            categoryId: transaction.categoryId || '',
            date: transaction.date!,
            amount: transaction.amount!,
            merchant: transaction.merchant || '',
            originalStatement: transaction.originalStatement || '',
            notes: transaction.notes || '',
            isHidden: transaction.isHidden || false,
            isSplit: false,
            splitParentId: ''
        };

        const created = await this.financeService.createTransaction(newTransaction);
        if (created) {
            this.saved = true;
            this.notificationService.success('Transaction added');
            this.router.navigate(['/transactions']);
        }
    }

    onCancel() {
        this.router.navigate(['/transactions']);
    }
}
