import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { registrationGuard } from './core/registration.guard';
import { unsavedChangesGuard } from './core/unsaved-changes.guard';
import { FinanceAccountDetailsComponent } from './finance/accounts/account-details.component';
import { FinanceAddAccountComponent } from './finance/accounts/add-account.component';
import { BalanceImportComponent } from './finance/accounts/balance-import.component';
import { FinanceEditAccountComponent } from './finance/accounts/edit-account.component';
import { FinanceBudgetComponent } from './finance/budget/budget.component';
import { FinanceSpendingComponent } from './finance/spending/spending.component';
import { FinanceInstitutionsComponent } from './finance/institutions/institutions.component';
import { DashboardComponent } from './finance/dashboard/dashboard.component';
import { FinanceCategoriesComponent } from './finance/categories/categories.component';
import { ImportCategoriesComponent } from './finance/categories/import-categories.component';
import { AddTransactionComponent } from './finance/transactions/add-transaction.component';
import { ImportTransactionsComponent } from './finance/transactions/import-transactions.component';
import { ViewTransactionComponent } from './finance/transactions/view-transaction.component';
import { EditTransactionComponent } from './finance/transactions/edit-transaction.component';
import { FinanceTransactionsComponent } from './finance/transactions/transactions.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { ApiTokensComponent } from './settings/api-tokens.component';
import { DashboardSettingsComponent } from './settings/dashboard-settings.component';
import { ProfileComponent } from './settings/profile.component';
import { SettingsComponent } from './settings/settings.component';

export const routes: Routes = [
    {
        path: 'login',
        component: LoginComponent,
        title: 'Login'
    },
    {
        path: 'register',
        component: RegisterComponent,
        canActivate: [registrationGuard],
        title: 'Register'
    },
    {
        path: '',
        canActivate: [authGuard],
        children: [
            { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
            { path: 'dashboard', component: DashboardComponent, title: 'Dashboard' },
            {
                path: 'accounts/new',
                component: FinanceAddAccountComponent,
                title: 'Add Account',
                canDeactivate: [unsavedChangesGuard]
            },
            { path: 'accounts/:accountId', component: FinanceAccountDetailsComponent, title: 'Account Details' },
            {
                path: 'accounts/:accountId/edit',
                component: FinanceEditAccountComponent,
                title: 'Edit Account',
                canDeactivate: [unsavedChangesGuard]
            },
            {
                path: 'accounts/:accountId/import-balances',
                component: BalanceImportComponent,
                title: 'Import Balance History'
            },
            { path: 'transactions', component: FinanceTransactionsComponent, title: 'Transactions' },
            {
                path: 'transactions/new',
                component: AddTransactionComponent,
                title: 'Add Transaction',
                canDeactivate: [unsavedChangesGuard]
            },
            { path: 'transactions/import', component: ImportTransactionsComponent, title: 'Import Transactions' },
            { path: 'transactions/:transactionId', component: ViewTransactionComponent, title: 'View Transaction' },
            {
                path: 'transactions/:transactionId/edit',
                component: EditTransactionComponent,
                title: 'Edit Transaction',
                canDeactivate: [unsavedChangesGuard]
            },
            { path: 'spending', component: FinanceSpendingComponent, title: 'Spending' },
            // Spending was called Cashflow (APP-1.1).
            { path: 'cashflow', redirectTo: 'spending' },
            { path: 'budget', component: FinanceBudgetComponent, title: 'Budget' },
            { path: 'settings', component: SettingsComponent, title: 'Settings' },
            {
                path: 'settings/profile',
                component: ProfileComponent,
                title: 'Profile',
                canDeactivate: [unsavedChangesGuard]
            },
            { path: 'settings/dashboard', component: DashboardSettingsComponent, title: 'Dashboard Settings' },
            {
                path: 'settings/institutions',
                component: FinanceInstitutionsComponent,
                title: 'Accounts and Institutions'
            },
            { path: 'settings/categories', component: FinanceCategoriesComponent, title: 'Categories' },
            {
                path: 'settings/categories/import',
                component: ImportCategoriesComponent,
                title: 'Import Categories'
            },
            { path: 'settings/api-tokens', component: ApiTokensComponent, title: 'API Tokens' }
        ]
    },
    {
        path: '**',
        redirectTo: ''
    }
];
