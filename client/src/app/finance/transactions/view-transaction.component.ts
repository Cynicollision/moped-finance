import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { CardSkeletonComponent } from './../../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../../core/loading/load-error.component';
import { viewResource } from './../../core/loading/view-resource';
import { SplitTransactionModalComponent, SplitTransactionModalData } from './split-transaction-modal.component';
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
        PageHeaderComponent,
        CardSkeletonComponent,
        LoadErrorComponent
    ],
    templateUrl: './view-transaction.component.html',
    styleUrl: './view-transaction.component.scss'
})
export class ViewTransactionComponent {
    private financeService = inject(FinanceService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);

    private readonly transactionId = this.route.snapshot.paramMap.get('transactionId');

    readonly data = viewResource({
        params: () => this.transactionId ?? undefined,
        loader: id => this.financeService.fetchTransaction(id)
    });
    readonly transaction = computed(() => this.data.value() ?? null);
    readonly isSplit = computed(() => (this.transaction()?.parts.length ?? 0) > 0);

    onEdit() {
        if (this.transactionId) {
            this.router.navigate(['/transactions', this.transactionId, 'edit']);
        }
    }

    /** Splits the transaction, or changes its parts when it's split (TXN-4.1, TXN-4.5). */
    async split() {
        const transaction = this.transaction();
        if (!transaction) {
            return;
        }

        const changed = await this.modalService.open<
            SplitTransactionModalComponent,
            SplitTransactionModalData,
            boolean
        >(SplitTransactionModalComponent, { transaction });
        if (changed) {
            this.data.reload();
        }
    }

    /** Turns it back into one transaction, after asking (TXN-4.5). */
    async unsplit() {
        if (!this.transactionId) {
            return;
        }

        const confirmed = await this.modalService.confirm({
            title: 'Unsplit Transaction',
            message:
                "Combine the parts back into one transaction? It takes the first part's category, merchant and notes.",
            confirmLabel: 'Unsplit'
        });
        if (confirmed && (await this.financeService.unsplitTransaction(this.transactionId))) {
            this.notificationService.success('Transaction unsplit');
            this.data.reload();
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
