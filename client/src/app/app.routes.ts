import { Routes } from '@angular/router';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { authGuard } from './core/auth.guard';
import { FinanceSummaryComponent } from './finance/components/summary.component';
import { FinanceAccountDetailsComponent } from './finance/components/account-details.component';
import { FinanceTransactionsComponent } from './finance/components/transactions.component';
import { FinanceBudgetComponent } from './finance/components/budget.component';
import { FinanceCashflowComponent } from './finance/components/cashflow.component';
import { FinanceTransactionDetailsComponent } from './finance/components/transaction-details.component';
import { FinanceInstitutionsComponent } from './finance/components/institutions.component';
import { FinanceAddInstitutionComponent } from './finance/components/add-institution.component';
import { FinanceAddAccountComponent } from './finance/components/add-account.component';
import { FinanceEditAccountComponent } from './finance/components/edit-account.component';

export const routes: Routes = [
    {
        path: 'login', component: LoginComponent,
        title: 'Login'
    },
    {
        path: 'register', component: RegisterComponent,
        title: 'Register'
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
            { path: 'budget', component: FinanceBudgetComponent, title: 'Budget' },
            { path: 'institutions', component: FinanceInstitutionsComponent, title: 'Institutions' },
            { path: 'institutions/add', component: FinanceAddInstitutionComponent, title: 'Add Institution' },
            { path: 'institutions/:id/add-account', component: FinanceAddAccountComponent, title: 'Add Account' },
            { path: 'accounts/:accountId/edit', component: FinanceEditAccountComponent, title: 'Edit Account' }
        ]
    },
    {
        path: '**',
        redirectTo: ''
    }
];