import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Transaction } from '@shared/finance/types';
import { PageHeaderComponent } from './../core/layout/page-header.component';
import { CardSkeletonComponent } from './../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { viewResource } from './../core/loading/view-resource';
import { NotificationService } from './../core/notification.service';
import { HasUnsavedChanges } from './../core/unsaved-changes';
import { TransactionFormComponent } from './transaction-form.component';
import { FinanceService } from './../common/finance.service';

@Component({
    selector: 'app-edit-transaction',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [TransactionFormComponent, PageHeaderComponent, CardSkeletonComponent, LoadErrorComponent],
    templateUrl: './edit-transaction.component.html',
    styleUrl: './edit-transaction.component.scss'
})
export class EditTransactionComponent implements HasUnsavedChanges {
    private financeService = inject(FinanceService);
    private notificationService = inject(NotificationService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    protected readonly transactionId = this.route.snapshot.paramMap.get('transactionId');

    private readonly form = viewChild(TransactionFormComponent);
    readonly saving = signal(false);
    private saved = false;

    readonly data = viewResource({
        params: () => this.transactionId ?? undefined,
        loader: id => this.financeService.fetchTransaction(id)
    });
    readonly transaction = computed(() => this.data.value() ?? null);

    hasUnsavedChanges(): boolean {
        return !this.saved && (this.form()?.hasUnsavedChanges() ?? false);
    }

    async onSave(updatedTransaction: Partial<Transaction>) {
        if (!this.transactionId) {
            return;
        }

        this.saving.set(true);
        const success = await this.financeService.saveTransaction(updatedTransaction as Transaction);
        this.saving.set(false);
        if (success) {
            this.saved = true;
            this.notificationService.success('Transaction saved');
            this.router.navigate(['/transactions', this.transactionId]);
        }
    }

    onCancel() {
        if (this.transactionId) {
            this.router.navigate(['/transactions', this.transactionId]);
        } else {
            this.router.navigate(['/transactions']);
        }
    }
}
