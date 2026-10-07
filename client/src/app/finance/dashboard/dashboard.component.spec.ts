import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountType } from '@shared/finance/enum';
import { Account } from '@shared/finance/types';
import { AccountTypeUtil } from '@shared/finance/util';
import { FinanceService } from './../finance.service';
import { DashboardComponent } from './dashboard.component';

describe('DashboardComponent', () => {
    function account(name: string, type: AccountType, balance: number): Account {
        return {
            id: name,
            institutionId: 'inst',
            name,
            type,
            group: AccountTypeUtil.groupOf(type),
            category: AccountTypeUtil.categoryOf(type),
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
            imports: [DashboardComponent],
            providers: [provideRouter([]), { provide: FinanceService, useValue: financeService }]
        });

        const fixture = TestBed.createComponent(DashboardComponent);
        await fixture.whenStable();
        return fixture.nativeElement as HTMLElement;
    }

    function groupRows(element: HTMLElement): string[] {
        return Array.from(element.querySelectorAll('.account-group .group-header-row')).map(row =>
            Array.from(row.children)
                .map(span => span.textContent!.trim())
                .join(' ')
        );
    }

    it('DASH-2.3 should list each account with a link to its details once the accounts load', async () => {
        const element = await render([account('Checking', AccountType.Checking, 1200)]);

        const link = element.querySelector<HTMLAnchorElement>('.account-group a')!;
        expect(link.textContent).toBe('Checking');
        expect(link.getAttribute('href')).toBe('/accounts/Checking');
        expect(groupRows(element)).toEqual(['Cash $1,200.00']);
    });

    it('DASH-2.4 should show liability balances as positive amounts', async () => {
        const element = await render([
            account('Visa', AccountType.CreditCard, -250.5),
            account('Mortgage', AccountType.Mortgage, -100000)
        ]);

        expect(groupRows(element)).toEqual(['Credit Cards $250.50', 'Loans $100,000.00']);
        const balances = Array.from(element.querySelectorAll('.account-group .row-item span')).map(e =>
            e.textContent!.trim()
        );
        expect(balances).toEqual(['$250.50', '$100,000.00']);
    });

    it('DASH-2.6 should show net worth as total assets minus the size of total liabilities', async () => {
        const element = await render([
            account('Checking', AccountType.Checking, 5000),
            account('Brokerage', AccountType.Brokerage, 2000),
            account('Visa', AccountType.CreditCard, -1500)
        ]);

        expect(element.querySelector('.large-value')!.textContent!.trim()).toBe('$5,500.00');
    });

    it('APP-2.1 should show placeholders, not zeros, until the accounts load', async () => {
        const financeService = {
            fetchAllAccounts: vi.fn().mockReturnValue(new Promise(() => undefined)),
            fetchTotalValueHistory: vi.fn().mockReturnValue(new Promise(() => undefined)),
            fetchAccountBalanceHistory: vi.fn().mockResolvedValue([])
        };
        TestBed.configureTestingModule({
            imports: [DashboardComponent],
            providers: [provideRouter([]), { provide: FinanceService, useValue: financeService }]
        });

        const fixture = TestBed.createComponent(DashboardComponent);
        fixture.detectChanges();
        const element = fixture.nativeElement as HTMLElement;

        expect(element.textContent).not.toContain('$0.00');
        expect(element.querySelectorAll('app-card-skeleton').length).toBeGreaterThan(0);
        expect(element.querySelector('app-value-history app-skeleton')).not.toBeNull();
    });

    it('APP-2.9 should show a failed load in place, and load again on Retry', async () => {
        const financeService = {
            fetchAllAccounts: vi
                .fn()
                .mockRejectedValueOnce(new Error('offline'))
                .mockResolvedValue([account('Checking', AccountType.Checking, 1200)]),
            fetchTotalValueHistory: vi.fn().mockResolvedValue([]),
            fetchAccountBalanceHistory: vi.fn().mockResolvedValue([])
        };
        TestBed.configureTestingModule({
            imports: [DashboardComponent],
            providers: [provideRouter([]), { provide: FinanceService, useValue: financeService }]
        });
        const fixture = TestBed.createComponent(DashboardComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;

        expect(element.querySelector('app-load-error')).not.toBeNull();
        expect(element.querySelector('.account-group')).toBeNull();

        element.querySelector<HTMLButtonElement>('app-load-error button')!.click();
        await fixture.whenStable();

        expect(element.querySelector('app-load-error')).toBeNull();
        expect(groupRows(element)).toEqual(['Cash $1,200.00']);
    });

    it('DASH-2.1 should leave out groups with no accounts', async () => {
        const element = await render([account('Checking', AccountType.Checking, 10)]);

        expect(groupRows(element).map(row => row.split(' ')[0])).toEqual(['Cash']);
    });

    it('DASH-2.1 should list the groups in order, whatever order the accounts come in', async () => {
        const element = await render([
            account('Mortgage', AccountType.Mortgage, -1),
            account('Car', AccountType.Vehicle, 1),
            account('Visa', AccountType.CreditCard, -1),
            account('House', AccountType.PrimaryResidence, 1),
            account('401(k)', AccountType.Retirement401k, 1),
            account('Brokerage', AccountType.Brokerage, 1),
            account('Checking', AccountType.Checking, 1)
        ]);

        expect(groupRows(element).map(row => row.replace(' $1.00', ''))).toEqual([
            'Cash',
            'Investments',
            'Retirement',
            'Real Estate',
            'Other Assets',
            'Credit Cards',
            'Loans'
        ]);
    });

    it('DASH-2.1 DASH-2.5 should split the groups into Assets and Liabilities, each ending with its total', async () => {
        const element = await render([
            account('Checking', AccountType.Checking, 1000),
            account('Roth IRA', AccountType.RothIRA, 5000),
            account('Car', AccountType.Vehicle, 8000),
            account('Visa', AccountType.CreditCard, -300)
        ]);

        const sections = Array.from(element.querySelectorAll('.accounts-card')).map(card => ({
            groups: Array.from(card.querySelectorAll('.header-label')).map(e => e.textContent!.trim()),
            total: Array.from(card.querySelectorAll('.section-total span')).map(e => e.textContent!.trim())
        }));
        expect(Array.from(element.querySelectorAll('.section-title')).map(e => e.textContent!.trim())).toEqual([
            'Assets',
            'Liabilities'
        ]);
        expect(sections).toEqual([
            { groups: ['Cash', 'Retirement', 'Other Assets'], total: ['Total Assets', '$14,000.00'] },
            { groups: ['Credit Cards'], total: ['Total Liabilities', '$300.00'] }
        ]);
    });

    it('DASH-2.1 should leave out a section with no accounts', async () => {
        const element = await render([account('Checking', AccountType.Checking, 10)]);

        expect(Array.from(element.querySelectorAll('.section-title')).map(e => e.textContent!.trim())).toEqual([
            'Assets'
        ]);
    });
});
