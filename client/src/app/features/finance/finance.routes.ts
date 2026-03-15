import { Routes } from '@angular/router';
import { FinanceComponent } from './finance.component';
import { FinanceSummaryComponent } from './components/summary.component';
import { FinanceAccountDetailsComponent } from './components/account-details.component';
import { FinanceTransactionsComponent } from './components/transactions.component';
import { FinanceBudgetComponent } from './components/budget.component';
import { FinanceSpendingComponent } from './components/spending.component';
import { FinanceTransactionDetailsComponent } from './components/transaction-details.component';

export const FINANCE_ROUTES: Routes = [
    {
        path: '',
        component: FinanceComponent,
        children: [
            { path: '', redirectTo: 'summary', pathMatch: 'full' },
            { path: 'summary', component: FinanceSummaryComponent },
            { path: 'accounts/:accountId', component: FinanceAccountDetailsComponent },
            { path: 'transactions', component: FinanceTransactionsComponent },
            { path: 'transactions/:transactionId', component: FinanceTransactionDetailsComponent },
            { path: 'budget', component: FinanceBudgetComponent },
            { path: 'spending', component: FinanceSpendingComponent }
        ]
    }
];