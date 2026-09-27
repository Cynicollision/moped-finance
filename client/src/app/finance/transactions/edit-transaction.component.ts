import { Component, inject, OnInit, signal } from '@angular/core';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Transaction } from '@shared/finance/types';
import { TransactionFormComponent } from './transaction-form.component';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-edit-transaction',
    standalone: true,
    imports: [RouterLink, TransactionFormComponent],
    templateUrl: './edit-transaction.component.html',
    styleUrl: './edit-transaction.component.scss'
})
export class EditTransactionComponent implements OnInit {
    private financeService = inject(FinanceService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

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

    async onSave(updatedTransaction: Partial<Transaction>) {
        if (!this.transactionId) return;

        const success = await this.financeService.saveTransaction(updatedTransaction as Transaction);
        if (success) {
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
