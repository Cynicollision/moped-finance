import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { registrationGuard } from './core/registration.guard';
import { unsavedChangesGuard } from './core/unsaved-changes.guard';
import { AccountDetailsComponent } from './accounts/account-details.component';
import { AddAccountComponent } from './accounts/add-account.component';
import { BalanceImportComponent } from './accounts/balance-import.component';
import { ManageAccountComponent } from './accounts/manage-account.component';
import { BankSyncComponent } from './bank-sync/bank-sync.component';
import { BudgetComponent } from './budget/budget.component';
import { SpendingComponent } from './spending/spending.component';
import { InstitutionsComponent } from './institutions/institutions.component';
import { DashboardComponent } from './dashboard/dashboard.component';
import { CategoriesComponent } from './categories/categories.component';
import { ImportCategoriesComponent } from './categories/import-categories.component';
import { AddTransactionComponent } from './transactions/add-transaction.component';
import { ImportTransactionsComponent } from './transactions/import-transactions.component';
import { ViewTransactionComponent } from './transactions/view-transaction.component';
import { EditTransactionComponent } from './transactions/edit-transaction.component';
import { TransactionsComponent } from './transactions/transactions.component';
import { LoginComponent } from './login/login.component';
import { RegisterComponent } from './register/register.component';
import { RuleFormComponent } from './rules/rule-form.component';
import { RulesComponent } from './rules/rules.component';
import { ApiTokensComponent } from './settings/api-tokens.component';
import { AppearanceComponent } from './settings/appearance.component';
import { ChangePasswordComponent } from './settings/change-password.component';
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
                component: AddAccountComponent,
                title: 'Add Account',
                canDeactivate: [unsavedChangesGuard]
            },
            { path: 'accounts/:accountId', component: AccountDetailsComponent, title: 'Account Details' },
            {
                path: 'accounts/:accountId/manage',
                component: ManageAccountComponent,
                title: 'Manage Account',
                canDeactivate: [unsavedChangesGuard]
            },
            // Edit Account's old address (ACCT-7 replaced it).
            { path: 'accounts/:accountId/edit', redirectTo: 'accounts/:accountId/manage' },
            {
                path: 'accounts/:accountId/import-balances',
                component: BalanceImportComponent,
                title: 'Import Balance History'
            },
            { path: 'transactions', component: TransactionsComponent, title: 'Transactions' },
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
            { path: 'spending', component: SpendingComponent, title: 'Spending' },
            // Spending was called Cashflow (APP-1.1).
            { path: 'cashflow', redirectTo: 'spending' },
            { path: 'budget', component: BudgetComponent, title: 'Budget' },
            { path: 'settings', component: SettingsComponent, title: 'Settings' },
            {
                path: 'settings/profile',
                component: ProfileComponent,
                title: 'Profile',
                canDeactivate: [unsavedChangesGuard]
            },
            { path: 'settings/appearance', component: AppearanceComponent, title: 'Appearance' },
            { path: 'settings/dashboard', component: DashboardSettingsComponent, title: 'Dashboard Settings' },
            {
                path: 'settings/institutions',
                component: InstitutionsComponent,
                title: 'Institutions and Accounts'
            },
            { path: 'settings/categories', component: CategoriesComponent, title: 'Categories' },
            {
                path: 'settings/categories/import',
                component: ImportCategoriesComponent,
                title: 'Import Categories'
            },
            { path: 'settings/rules', component: RulesComponent, title: 'Rules' },
            {
                path: 'settings/rules/new',
                component: RuleFormComponent,
                title: 'New Rule',
                canDeactivate: [unsavedChangesGuard]
            },
            {
                path: 'settings/rules/:ruleId',
                component: RuleFormComponent,
                title: 'Edit Rule',
                canDeactivate: [unsavedChangesGuard]
            },
            { path: 'settings/bank-sync', component: BankSyncComponent, title: 'Bank Sync' },
            {
                path: 'settings/change-password',
                component: ChangePasswordComponent,
                title: 'Change Password',
                canDeactivate: [unsavedChangesGuard]
            },
            { path: 'settings/api-tokens', component: ApiTokensComponent, title: 'API Tokens' }
        ]
    },
    {
        path: '**',
        redirectTo: ''
    }
];
