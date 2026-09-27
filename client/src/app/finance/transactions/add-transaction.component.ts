import { Component, inject, OnInit } from '@angular/core';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { NewEntity } from '@shared/core/types';
import { Transaction } from '@shared/finance/types';
import { TransactionFormComponent } from './transaction-form.component';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-add-transaction',
    standalone: true,
    imports: [RouterLink, TransactionFormComponent],
    templateUrl: './add-transaction.component.html',
    styleUrl: './add-transaction.component.scss'
})
export class AddTransactionComponent implements OnInit {
    private financeService = inject(FinanceService);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    defaultAccountId?: string;

    ngOnInit() {
        this.defaultAccountId = this.route.snapshot.queryParamMap.get('accountId') || undefined;
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
            this.router.navigate(['/transactions']);
        }
    }

    onCancel() {
        this.router.navigate(['/transactions']);
    }
}
