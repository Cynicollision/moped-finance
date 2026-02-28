import { Component, inject, computed } from '@angular/core';
import { JsonPipe, CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { AccountType } from '@shared/types/finance/entities/account';
import { FinanceService } from './../finance.service';

@Component({
  selector: 'app-finance-summary',
  standalone: true,
  imports: [JsonPipe, CurrencyPipe, MatCardModule, MatDividerModule],
  templateUrl: './summary.component.html'
})
export class FinanceSummaryComponent {
  financeService = inject(FinanceService);

  summary = computed(() => {
    const profile = this.financeService.profileData();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts = profile?.accounts || [];

    let cash = 0;
    let investments = 0;
    let retirement = 0;
    let realEstate = 0;
    let creditCards = 0;
    let loans = 0;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const account of accounts as any[]) {
      const balance = Number(account.balance) || 0;
      const type = (account.type || '');

      console.log(account);

      if (type === AccountType.Cash) {
        cash += balance;
      }
      else if (type === AccountType.Investment) {
        investments += balance;
        if (account.isRetirement) {
          retirement += balance;
        }
      }
      else if (type === AccountType.RealEstate) {
        realEstate += balance;
      }
      else if (type === AccountType.CreditCard) {
        creditCards += balance;
      }
      else if (type === AccountType.Loan) {
        loans += balance;
      }
    }

    const totalAssets = cash + investments + realEstate;
    const totalLiabilities = creditCards + loans;

    return {
      netWorth: totalAssets - totalLiabilities,
      totalAssets,
      totalLiabilities,
      cash,
      investments,
      retirement,
      realEstate,
      creditCards,
      loans
    };
  });
}