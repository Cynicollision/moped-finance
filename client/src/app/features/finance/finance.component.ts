import { Component } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { FinanceSummaryComponent } from './components/summary.component';
import { FinanceAccountsComponent } from './components/accounts.component';
import { FinanceTransactionsComponent } from './components/transactions.component';
import { FinanceReportsComponent } from './components/reports.component';
import { FinanceSettingsComponent } from './components/settings.component';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [
    MatCardModule,
    MatTabsModule,
    FinanceSummaryComponent,
    FinanceAccountsComponent,
    FinanceTransactionsComponent,
    FinanceReportsComponent,
    FinanceSettingsComponent
  ],
  templateUrl: './finance.component.html'
})
export class FinanceComponent {}