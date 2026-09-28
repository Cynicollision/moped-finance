import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { registrationGuard } from './core/registration.guard';
import { FinanceAccountDetailsComponent } from './finance/accounts/account-details.component';
import { FinanceAddAccountComponent } from './finance/accounts/add-account.component';
import { BalanceImportComponent } from './finance/accounts/balance-import.component';
import { FinanceEditAccountComponent } from './finance/accounts/edit-account.component';
import { FinanceBudgetComponent } from './finance/budget/budget.component';
import { FinanceCashflowComponent } from './finance/cashflow/cashflow.component';
import { NewInstitutionComponent } from './finance/institutions/new-institution.component';
import { ViewInstitutionComponent } from './finance/institutions/view-institution.component';
import { EditInstitutionComponent } from './finance/institutions/edit-institution.component';
import { FinanceInstitutionsComponent } from './finance/institutions/institutions.component';
import { DashboardComponent } from './finance/dashboard/dashboard.component';
import { FinanceCategoriesComponent } from './finance/categories/categories.component';
import { AddTransactionComponent } from './finance/transactions/add-transaction.component';
import { ImportTransactionsComponent } from './finance/transactions/import-transactions.component';
import { ViewTransactionComponent } from './finance/transactions/view-transaction.component';
import { EditTransactionComponent } from './finance/transactions/edit-transaction.component';
import { FinanceTransactionsComponent } from './finance/transactions/transactions.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { ApiTokensComponent } from './settings/api-tokens.component';
import { SettingsComponent } from './settings/settings.component';

export const routes: Routes = [
    {
        path: 'login', component: LoginComponent,
        title: 'Login'
    },
    {
        path: 'register', component: RegisterComponent,
        canActivate: [registrationGuard],
        title: 'Register'
    },
    {
        path: '',
        canActivate: [authGuard],
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { path: 'dashboard', component: DashboardComponent, title: 'Dashboard' },
            { path: 'accounts/new', component: FinanceAddAccountComponent, title: 'Add Account' },
            { path: 'accounts/:accountId', component: FinanceAccountDetailsComponent, title: 'Account Details' },
            { path: 'accounts/:accountId/edit', component: FinanceEditAccountComponent, title: 'Edit Account' },
            { path: 'accounts/:accountId/import-balances', component: BalanceImportComponent, title: 'Import Balance History' },
            { path: 'transactions', component: FinanceTransactionsComponent, title: 'Transactions' },
            { path: 'transactions/new', component: AddTransactionComponent, title: 'Add Transaction' },
            { path: 'transactions/import', component: ImportTransactionsComponent, title: 'Import Transactions' },
            { path: 'transactions/:transactionId', component: ViewTransactionComponent, title: 'View Transaction' },
            { path: 'transactions/:transactionId/edit', component: EditTransactionComponent, title: 'Edit Transaction' },
            { path: 'cashflow', component: FinanceCashflowComponent, title: 'Cashflow' },
            { path: 'budget', component: FinanceBudgetComponent, title: 'Budget' },
            { path: 'settings', component: SettingsComponent, title: 'Settings' },
            { path: 'settings/institutions', component: FinanceInstitutionsComponent, title: 'Institutions' },
            { path: 'settings/institutions/new', component: NewInstitutionComponent, title: 'Add Institution' },
            { path: 'settings/institutions/:id', component: ViewInstitutionComponent, title: 'View Institution' },
            { path: 'settings/institutions/:id/edit', component: EditInstitutionComponent, title: 'Edit Institution' },
            { path: 'settings/categories', component: FinanceCategoriesComponent, title: 'Categories' },
            { path: 'settings/api-tokens', component: ApiTokensComponent, title: 'API Tokens' }
        ]
    },
    {
        path: '**',
        redirectTo: ''
    }
];
