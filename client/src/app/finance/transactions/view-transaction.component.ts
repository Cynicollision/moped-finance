import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Router, ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { map } from 'rxjs';
import { Transaction } from '@shared/finance/types';
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

    // The parts of a split link to each other, which reuses this screen, so the ID can change.
    private readonly transactionId = toSignal(this.route.paramMap.pipe(map(params => params.get('transactionId'))), {
        initialValue: this.route.snapshot.paramMap.get('transactionId')
    });

    readonly data = viewResource({
        params: () => this.transactionId() ?? undefined,
        loader: async id => {
            const transaction = await this.financeService.fetchTransaction(id);
            const splitParts = transaction.splitId ? await this.financeService.fetchTransactionSplit(id) : [];
            return { transaction, splitParts };
        }
    });
    readonly transaction = computed(() => this.data.value()?.transaction ?? null);
    readonly splitParts = computed(() => this.data.value()?.splitParts ?? []);
    readonly isSplit = computed(() => !!this.transaction()?.splitId);

    onEdit() {
        const id = this.transactionId();
        if (id) {
            this.router.navigate(['/transactions', id, 'edit']);
        }
    }

    /** Splits the transaction, or changes its split's parts (TXN-4.1, TXN-4.5). */
    async split() {
        const transaction = this.transaction();
        if (!transaction) {
            return;
        }

        const parts = await this.modalService.open<
            SplitTransactionModalComponent,
            SplitTransactionModalData,
            Transaction[]
        >(SplitTransactionModalComponent, { transaction, parts: this.splitParts() });
        if (parts) {
            this.showOrReload(parts.some(part => part.id === transaction.id) ? transaction.id : parts[0].id);
        }
    }

    /** Turns the split back into one transaction, its first part, after asking (TXN-4.5). */
    async unsplit() {
        const id = this.transactionId();
        const first = this.splitParts()[0];
        if (!id || !first) {
            return;
        }

        const confirmed = await this.modalService.confirm({
            title: 'Unsplit Transaction',
            message:
                "Combine the parts back into one transaction? It takes the first part's category, merchant and notes.",
            confirmLabel: 'Unsplit'
        });
        if (confirmed && (await this.financeService.unsplitTransaction(id))) {
            this.notificationService.success('Transaction unsplit');
            this.showOrReload(first.id);
        }
    }

    /** Reloads this transaction, or opens another when this one is gone. */
    private showOrReload(id: string) {
        if (id === this.transactionId()) {
            this.data.reload();
        } else {
            this.router.navigate(['/transactions', id]);
        }
    }

    async deleteTransaction() {
        const id = this.transactionId();
        if (!id) {
            return;
        }

        // Deleting a part deletes its whole split (TXN-4.7).
        const others = Math.max(this.splitParts().length - 1, 0);
        const message =
            others > 0
                ? `Delete this transaction and its ${others === 1 ? 'other part' : `${others} other parts`}? This can't be undone.`
                : "Delete this transaction? This can't be undone.";
        const confirmDelete = await this.modalService.confirm({
            title: 'Delete Transaction',
            message,
            confirmLabel: 'Delete',
            isWarn: true
        });

        if (confirmDelete) {
            const success = await this.financeService.deleteTransaction(id);
            if (success) {
                this.notificationService.success('Transaction deleted');
                this.router.navigate(['/transactions']);
            }
        }
    }
}
