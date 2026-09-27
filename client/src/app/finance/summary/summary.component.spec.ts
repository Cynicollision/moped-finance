import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';
import { Account } from '@shared/finance/types';
import { FinanceService } from './../finance.service';
import { FinanceSummaryComponent } from './summary.component';

describe('FinanceSummaryComponent', () => {
    function account(name: string, group: AccountGroup, balance: number): Account {
        const isLiability = group === AccountGroup.CreditCard || group === AccountGroup.Loan;
        return {
            id: name,
            institutionId: 'inst',
            name,
            category: isLiability ? AccountCategory.Liability : AccountCategory.Asset,
            group,
            type: group === AccountGroup.Cash ? AccountType.Checking : null,
            balance,
            createdAt: new Date(2026, 0, 1),
            updatedAt: new Date(2026, 0, 1)
        };
    }

    // Renders the summary once its accounts have loaded, the way the screen first appears.
    async function render(accounts: Account[]): Promise<HTMLElement> {
        const financeService = {
            fetchAllAccounts: vi.fn().mockResolvedValue(accounts),
            fetchTotalValueHistory: vi.fn().mockResolvedValue([]),
            fetchAccountBalanceHistory: vi.fn().mockResolvedValue([])
        };
        TestBed.configureTestingModule({
            imports: [FinanceSummaryComponent],
            providers: [provideRouter([]), { provide: FinanceService, useValue: financeService }]
        });

        const fixture = TestBed.createComponent(FinanceSummaryComponent);
        await fixture.whenStable();
        return fixture.nativeElement as HTMLElement;
    }

    function groupRows(element: HTMLElement): string[] {
        return Array.from(element.querySelectorAll('.account-group .group-header-row'))
            .map(row => Array.from(row.children).map(span => span.textContent!.trim()).join(' '));
    }

    it('DASH-2.3 should list each account with a link to its details once the accounts load', async () => {
        const element = await render([account('Checking', AccountGroup.Cash, 1200)]);

        const link = element.querySelector<HTMLAnchorElement>('.account-group a')!;
        expect(link.textContent).toBe('Checking');
        expect(link.getAttribute('href')).toBe('/accounts/Checking');
        expect(groupRows(element)).toEqual(['Cash $1,200.00']);
    });

    it('DASH-2.4 should show liability balances as positive amounts', async () => {
        const element = await render([
            account('Visa', AccountGroup.CreditCard, -250.5),
            account('Mortgage', AccountGroup.Loan, -100000)
        ]);

        expect(groupRows(element)).toEqual(['Credit Cards $250.50', 'Loans $100,000.00']);
        const balances = Array.from(element.querySelectorAll('.account-group .row-item span')).map(e => e.textContent!.trim());
        expect(balances).toEqual(['$250.50', '$100,000.00']);
    });

    it('DASH-2.6 should show net worth as total assets minus the size of total liabilities', async () => {
        const element = await render([
            account('Checking', AccountGroup.Cash, 5000),
            account('Brokerage', AccountGroup.Investment, 2000),
            account('Visa', AccountGroup.CreditCard, -1500)
        ]);

        expect(element.querySelector('.large-value')!.textContent!.trim()).toBe('$5,500.00');
    });

    it('should leave out groups with no accounts', async () => {
        const element = await render([account('Checking', AccountGroup.Cash, 10)]);

        expect(groupRows(element).map(row => row.split(' ')[0])).toEqual(['Cash']);
    });
});
