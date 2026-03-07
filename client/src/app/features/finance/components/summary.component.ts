import { Component, inject, computed } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatDividerModule } from '@angular/material/divider';
import { AccountType } from '@shared/finance/enum';
import { FinanceService } from './../finance.service';

@Component({
    selector: 'app-finance-summary',
    standalone: true,
    imports: [CurrencyPipe, MatCardModule, MatDividerModule],
    templateUrl: './summary.component.html',
    styleUrl: './summary.component.scss'
})
export class FinanceSummaryComponent {
    financeService = inject(FinanceService);

    summary = computed(() => {
        const profile = this.financeService.profileData();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const accounts = profile?.accounts || [];

        const cashAccounts: any[] = [];
        const investmentAccounts: any[] = [];
        const realEstateAccounts: any[] = [];
        const creditCardAccounts: any[] = [];
        const loanAccounts: any[] = [];

        let cashTotal = 0;
        let investmentsTotal = 0;
        let realEstateTotal = 0;
        let creditCardsTotal = 0;
        let loansTotal = 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const account of accounts as any[]) {
            const balance = Number(account.balance) || 0;
            const type = (account.type || '');

            if (type === AccountType.Cash) {
                cashTotal += balance;
                cashAccounts.push(account);
            }
            else if (type === AccountType.Investment) {
                investmentsTotal += balance;
                investmentAccounts.push(account);
            }
            else if (type === AccountType.RealEstate) {
                realEstateTotal += balance;
                realEstateAccounts.push(account);
            }
            else if (type === AccountType.CreditCard) {
                creditCardsTotal += balance;
                creditCardAccounts.push(account);
            }
            else if (type === AccountType.Loan) {
                loansTotal += balance;
                loanAccounts.push(account);
            }
        }

        const totalAssets = cashTotal + investmentsTotal + realEstateTotal;
        const totalLiabilities = creditCardsTotal + loansTotal;

        return {
            netWorth: totalAssets - totalLiabilities,
            totalAssets,
            totalLiabilities,
            cash: cashTotal,
            investments: investmentsTotal,
            realEstate: realEstateTotal,
            creditCards: creditCardsTotal,
            loans: loansTotal,
            cashAccounts,
            investmentAccounts,
            realEstateAccounts,
            creditCardAccounts,
            loanAccounts
        };
    });
}