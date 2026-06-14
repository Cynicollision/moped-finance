import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { FinanceAccountDetailsComponent } from './finance/accounts/account-details.component';
import { FinanceAddAccountComponent } from './finance/accounts/add-account.component';
import { BalanceImportComponent } from './finance/accounts/balance-import.component';
import { FinanceEditAccountComponent } from './finance/accounts/edit-account.component';
import { FinanceBudgetComponent } from './finance/budget/budget.component';
import { FinanceCashflowComponent } from './finance/cashflow/cashflow.component';
import { FinanceAddInstitutionComponent } from './finance/institutions/add-institution.component';
import { FinanceInstitutionsComponent } from './finance/institutions/institutions.component';
import { FinanceSummaryComponent } from './finance/summary/summary.component';
import { FinanceCategoriesComponent } from './finance/categories/categories.component';
import { AddTransactionComponent } from './finance/transactions/add-transaction.component';
import { ImportTransactionsComponent } from './finance/transactions/import-transactions.component';
import { FinanceTransactionDetailsComponent } from './finance/transactions/transaction-details.component';
import { FinanceTransactionsComponent } from './finance/transactions/transactions.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';

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
            { path: 'transactions/new', component: AddTransactionComponent, title: 'Add Transaction' },
            { path: 'transactions/import', component: ImportTransactionsComponent, title: 'Import Transactions' },
            { path: 'transactions/:transactionId', component: FinanceTransactionDetailsComponent, title: 'Transaction Details' },
            { path: 'cashflow', component: FinanceCashflowComponent, title: 'Cashflow' },
            { path: 'budget', component: FinanceBudgetComponent, title: 'Budget' },
            { path: 'institutions', component: FinanceInstitutionsComponent, title: 'Institutions' },
            { path: 'institutions/add', component: FinanceAddInstitutionComponent, title: 'Add Institution' },
            { path: 'categories', component: FinanceCategoriesComponent, title: 'Categories' },
            { path: 'institutions/:id/add-account', component: FinanceAddAccountComponent, title: 'Add Account' },
            { path: 'accounts/:accountId/edit', component: FinanceEditAccountComponent, title: 'Edit Account' },
            { path: 'accounts/:accountId/import-balances', component: BalanceImportComponent, title: 'Import Balance History' }
        ]
    },
    {
        path: '**',
        redirectTo: ''
    }
];