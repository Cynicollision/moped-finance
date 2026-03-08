import { Routes } from '@angular/router';
import { FinanceComponent } from './finance.component';
import { FinanceSummaryComponent } from './components/summary.component';
import { FinanceAccountsComponent } from './components/accounts.component';
import { FinanceTransactionsComponent } from './components/transactions.component';
import { FinanceReportsComponent } from './components/reports.component';
import { FinanceSettingsComponent } from './components/settings.component';

export const FINANCE_ROUTES: Routes = [
    {
        path: '',
        component: FinanceComponent,
        children: [
            { path: '', redirectTo: 'summary', pathMatch: 'full' },
            { path: 'summary', component: FinanceSummaryComponent },
            { path: 'accounts', component: FinanceAccountsComponent },
            { path: 'transactions', component: FinanceTransactionsComponent },
            { path: 'reports', component: FinanceReportsComponent },
            { path: 'settings', component: FinanceSettingsComponent }
        ]
    }
];