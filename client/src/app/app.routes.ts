import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { authGuard } from './core/auth.guard';
import { FinanceSummaryComponent } from './finance/components/summary.component';
import { FinanceAccountDetailsComponent } from './finance/components/account-details.component';
import { FinanceTransactionsComponent } from './finance/components/transactions.component';
import { FinanceBudgetComponent } from './finance/components/budget.component';
import { FinanceCashflowComponent } from './finance/components/cashflow.component';
import { FinanceTransactionDetailsComponent } from './finance/components/transaction-details.component';

export const routes: Routes = [
    {
        path: 'login', component: LoginComponent,
        title: 'Login'
    },
    {
        path: '',
        canActivate: [authGuard],
        children: [
            { path: '', redirectTo: 'summary', pathMatch: 'full' },
            { path: 'summary', component: FinanceSummaryComponent, title: 'Dashboard' },
            { path: 'accounts/:accountId', component: FinanceAccountDetailsComponent, title: 'Account Details' },
            { path: 'transactions', component: FinanceTransactionsComponent, title: 'Transactions' },
            { path: 'transactions/:transactionId', component: FinanceTransactionDetailsComponent, title: 'Transaction Details' },
            { path: 'cashflow', component: FinanceCashflowComponent, title: 'Cashflow' },
            { path: 'budget', component: FinanceBudgetComponent, title: 'Budget' }
        ]
    },
    {
        path: '**',
        redirectTo: ''
    }
];