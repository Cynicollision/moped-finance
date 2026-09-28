import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { PageHeaderComponent } from './../../core/layout/page-header.component';
import { CardSkeletonComponent } from './../../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../../core/loading/load-error.component';
import { viewResource } from './../../core/loading/view-resource';
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
