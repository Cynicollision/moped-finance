import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TransactionSearchOptions } from '@shared/finance/contracts';
import { Transaction } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { FinanceService } from './../finance.service';
import { FinanceTransactionsComponent } from './transactions.component';

// Tests run with TZ=America/New_York (vitest-base.config.mjs), where a date read as UTC midnight is the day before.
describe('FinanceTransactionsComponent', () => {
    function transaction(id: string, date: string): Transaction {
        return {
            id, date, accountId: 'acct', categoryId: '', amount: -10, merchant: id, originalStatement: '', notes: '',
            isHidden: false, isSplit: false, splitParentId: '', createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 1)
        };
    }

    // Renders Transactions opened with the given query string, once its first page has loaded.
    async function render(queryParams: Record<string, string> = {}, transactions: Transaction[] = [], nextPage: Transaction[] = []) {
        const financeService = {
            fetchTransactionMerchants: vi.fn().mockResolvedValue([]),
            fetchCategories: vi.fn().mockResolvedValue([]),
            fetchAllAccounts: vi.fn().mockResolvedValue([]),
            fetchCategoryGroups: vi.fn().mockResolvedValue([]),
            fetchTransactions: vi.fn().mockResolvedValueOnce(transactions).mockResolvedValue(nextPage)
        };
        TestBed.configureTestingModule({
            imports: [FinanceTransactionsComponent],
            providers: [
                provideRouter([]),
                { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
                { provide: DateProviderService, useValue: { now: () => new Date(2026, 4, 17), today: () => '2026-05-17' } },
                { provide: FinanceService, useValue: financeService }
            ]
        });

        const fixture = TestBed.createComponent(FinanceTransactionsComponent);
        await fixture.whenStable();
        await vi.waitFor(() => expect(financeService.fetchTransactions).toHaveBeenCalled());
        await fixture.whenStable();

        const lastSearch = (): TransactionSearchOptions => financeService.fetchTransactions.mock.lastCall![0];
        return { fixture, element: fixture.nativeElement as HTMLElement, lastSearch, financeService };
    }

    it('TXN-1.1 should show each transaction on its own date', async () => {
        const { element } = await render({}, [transaction('a', '2026-05-01'), transaction('b', '2026-04-30')]);

        const dates = Array.from(element.querySelectorAll('td.mat-column-date')).map(cell => cell.textContent!.trim());
        expect(dates).toEqual(['May 1, 2026', 'Apr 30, 2026']);
    });

    it('TXN-1.3 should load 25 at a time and append the next 25 with Load More', async () => {
        const page = Array.from({ length: 25 }, (_, i) => transaction('t' + i, '2026-05-01'));
        const { fixture, element, lastSearch } = await render({}, page, [transaction('t25', '2026-04-01')]);

        expect(lastSearch()).toEqual(expect.objectContaining({ limit: 25, offset: 0 }));
        expect(element.querySelectorAll('tr.mat-mdc-row').length).toBe(25);

        const loadMore = Array.from(element.querySelectorAll<HTMLButtonElement>('.footer button')).find(b => b.textContent!.includes('Load More'))!;
        loadMore.click();
        await fixture.whenStable();

        expect(lastSearch()).toEqual(expect.objectContaining({ limit: 25, offset: 25 }));
        expect(element.querySelectorAll('tr.mat-mdc-row').length).toBe(26);
        // The last page wasn't full, so there's nothing more to load.
        expect(element.querySelector('.footer')).toBeNull();
    });

    it('TXN-1.10 should search up to today by default, sending it as YYYY-MM-DD', async () => {
        const { lastSearch } = await render();

        expect(lastSearch().startDate).toBeUndefined();
        expect(lastSearch().endDate).toBe('2026-05-17');
    });

    it('TXN-1.7 should show and search the start and end dates from the link that opened it', async () => {
        const { fixture, lastSearch } = await render({ startDate: '2026-04-01', endDate: '2026-04-30' });

        const { startDate, endDate } = fixture.componentInstance.filterForm.value;
        expect([startDate!.getMonth(), startDate!.getDate()]).toEqual([3, 1]);
        expect([endDate!.getMonth(), endDate!.getDate()]).toEqual([3, 30]);
        expect(lastSearch()).toEqual(expect.objectContaining({ startDate: '2026-04-01', endDate: '2026-04-30' }));
    });

    it('TXN-1.7 should ignore a date in the link that is not YYYY-MM-DD', async () => {
        const { lastSearch } = await render({ startDate: 'soon' });

        expect(lastSearch().startDate).toBeUndefined();
    });
});
