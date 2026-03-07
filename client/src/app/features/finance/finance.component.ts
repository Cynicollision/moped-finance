import { Component, OnInit, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { FinanceProfile } from '@shared/types/entities/finance/profile';
import { FinanceSummaryComponent } from './components/summary.component';
import { FinanceAccountsComponent } from './components/accounts.component';
import { FinanceTransactionsComponent } from './components/transactions.component';
import { FinanceReportsComponent } from './components/reports.component';
import { FinanceSettingsComponent } from './components/settings.component';
import { FinanceService } from './finance.service';

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
export class FinanceComponent implements OnInit {
  private financeService = inject(FinanceService);

  profileData = signal<FinanceProfile | undefined>(undefined);

  async ngOnInit() {
    const data = await this.financeService.fetchProfileData();
    this.profileData.set(data);
  }
}