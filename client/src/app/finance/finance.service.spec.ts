import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { CalendarPeriod, HistoryTimeframe, SortDirection } from '@shared/core/enum';
import {
    TransactionDirection,
    TransactionsFilterKey,
    TransactionsSortKey,
    ValueHistoryType
} from '@shared/finance/enum';
import { Transaction } from '@shared/finance/types';
import { DateProviderService } from './../core/date-provider.service';
import { NotificationService } from './../core/notification.service';
import { FinanceService } from './finance.service';

describe('FinanceService', () => {
    function setup() {
        const notificationService = { error: vi.fn() };
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(),
                provideHttpClientTesting(),
                { provide: NotificationService, useValue: notificationService },
                { provide: DateProviderService, useValue: { today: () => '2026-05-17' } }
            ]
        });
        return {
            finance: TestBed.inject(FinanceService),
            http: TestBed.inject(HttpTestingController),
            notificationService
        };
    }

    it('TXN-1.5 should send every transaction search option the screen sets, and leave out the rest', async () => {
        const { finance, http } = setup();

        const all = finance.fetchTransactions({
            sortKey: TransactionsSortKey.Date,
            sortDirection: SortDirection.Desc,
            offset: 0,
            limit: 50,
            minAmount: 0,
            maxAmount: 100,
            direction: TransactionDirection.Out,
            startDate: '2026-05-01',
            endDate: '2026-05-31',
            filters: [{ key: TransactionsFilterKey.AccountId, value: 'a1' }],
            includeHidden: true
        });
        const request = http.expectOne(r => r.url.startsWith('/api/v1/transactions?'));
        const params = new URLSearchParams(request.request.url.split('?')[1]);
        expect(Object.fromEntries(params)).toEqual({
            sortKey: 'date',
            sortDirection: 'DESC',
            offset: '0',
            limit: '50',
            minAmount: '0',
            maxAmount: '100',
            direction: 'out',
            startDate: '2026-05-01',
            endDate: '2026-05-31',
            filters: '[{"key":"account_id","value":"a1"}]',
            includeHidden: 'true'
        });
        request.flush([]);
        await all;

        const none = finance.fetchTransactions({});
        http.expectOne('/api/v1/transactions?').flush([]);
        await none;
    });

    it("ACCT-2.7 should load an account's ten most recent transactions", async () => {
        const { finance, http } = setup();

        const recent = finance.fetchAccountRecentTransactions('a1');
        http.expectOne('/api/v1/accounts/a1/transactions?sortKey=date&sortDirection=DESC&limit=10').flush([]);

        expect(await recent).toEqual([]);
    });

    it("ACCT-2.1 APP-4.1 should ask for accounts' balances as of the app's today", async () => {
        const { finance, http } = setup();

        const all = finance.fetchAllAccounts();
        http.expectOne('/api/v1/accounts?asOfDate=2026-05-17').flush([]);
        await all;

        const single = finance.fetchAccount('a1');
        http.expectOne('/api/v1/accounts/a1?asOfDate=2026-05-17').flush({});
        await single;
    });

    it("DASH-2.2 APP-4.1 should ask for group changes over the timeframe up to the app's today", async () => {
        const { finance, http } = setup();

        const changes = finance.fetchAccountGroupChanges(HistoryTimeframe.YearToDate);
        http.expectOne('/api/v1/accounts/group-changes?asOfDate=2026-05-17&timeframe=YearToDate').flush([]);

        expect(await changes).toEqual([]);
    });

    it("APP-4.1 should ask for value history as of the app's today", async () => {
        const { finance, http } = setup();

        const history = finance.fetchTotalValueHistory(ValueHistoryType.NetWorth, HistoryTimeframe.PastThirtyDays);
        http.expectOne(
            '/api/v1/accounts/total-value-history?asOfDate=2026-05-17&type=NetWorth&timeframe=PastThirtyDays'
        ).flush([]);
        await history;

        const spending = finance.fetchSpendingTotals(CalendarPeriod.Monthly, '2026-04-15');
        http.expectOne('/api/v1/transactions/spending?period=Monthly&asOfDate=2026-04-15').flush([]);
        await spending;
    });

    it('TXN-3.5 should import transactions into one account only when started from it', async () => {
        const { finance, http } = setup();
        const file = new FormData();

        const anyAccount = finance.importTransactions(file, true);
        const request = http.expectOne('/api/v1/transactions/import?dryRun=true');
        expect(request.request.body).toBe(file);
        request.flush({ isValidToImport: true });
        await anyAccount;

        const oneAccount = finance.importTransactions(file, false, 'a1');
        http.expectOne('/api/v1/transactions/import?dryRun=false&accountId=a1').flush({ isValidToImport: true });
        await oneAccount;

        const adjusting = finance.importTransactions(file, false, 'a1', true);
        http.expectOne('/api/v1/transactions/import?dryRun=false&accountId=a1&adjustBalances=true').flush({
            isValidToImport: true
        });
        await adjusting;

        expect(finance.getExportTransactionsUrl()).toBe('api/v1/transactions/export');
        expect(finance.getExportTransactionsUrl('a1')).toBe('api/v1/transactions/export?accountId=a1');
    });

    it('CAT-7.1 CAT-7.2 should import categories as a dry run or for real, and export them', async () => {
        const { finance, http } = setup();
        const file = new FormData();

        const dryRun = finance.importCategories(file, true);
        const request = http.expectOne('/api/v1/categories/import?dryRun=true');
        expect(request.request.method).toBe('POST');
        expect(request.request.body).toBe(file);
        request.flush({ isValidToImport: true });
        await dryRun;

        const realRun = finance.importCategories(file, false);
        http.expectOne('/api/v1/categories/import?dryRun=false').flush({ isValidToImport: true });
        await realRun;

        expect(finance.getExportCategoriesUrl()).toBe('api/v1/categories/export');
    });

    it('ACCT-3.3 should dry-run a balance import before the real one', async () => {
        const { finance, http } = setup();

        const dryRun = finance.importBalanceHistory('a1', new FormData(), true);
        http.expectOne('/api/v1/accounts/a1/import-balances?dryRun=true').flush({ isValidToImport: true });
        await dryRun;

        expect(finance.getExportBalanceHistoryUrl('a1')).toBe('/api/v1/accounts/a1/export-balances');
    });

    it('TXN-2.3 TXN-2.4 should save a transaction to its own address and delete it by ID', async () => {
        const { finance, http } = setup();
        const transaction = { id: 't1', merchant: 'Shop' } as Transaction;

        const save = finance.saveTransaction(transaction);
        const put = http.expectOne('/api/v1/transactions/t1');
        expect(put.request.method).toBe('PUT');
        expect(put.request.body).toBe(transaction);
        put.flush(transaction);
        expect(await save).toBe(transaction);

        const remove = finance.deleteTransaction('t1');
        const del = http.expectOne('/api/v1/transactions/t1');
        expect(del.request.method).toBe('DELETE');
        del.flush(null);
        expect(await remove).toBe(true);
    });

    it('CAT-4.4 should delete a category, naming the category its transactions move to when there is one', async () => {
        const { finance, http } = setup();

        const uncategorized = finance.deleteCategory('rent');
        http.expectOne(r => r.method === 'DELETE' && r.url === '/api/v1/categories/rent').flush(null);
        expect(await uncategorized).toBe(true);

        const moved = finance.deleteCategory('rent', 'mortgage');
        http.expectOne(r => r.method === 'DELETE' && r.url === '/api/v1/categories/rent?moveTo=mortgage').flush(null);
        expect(await moved).toBe(true);
    });

    it('APP-2.9 should throw from a load, while an action reports its failure and resolves to undefined', async () => {
        const { finance, http, notificationService } = setup();

        const load = finance.fetchTransaction('t1');
        http.expectOne('/api/v1/transactions/t1').flush(
            { message: 'Transaction not found.' },
            { status: 404, statusText: 'Not Found' }
        );
        await expect(load).rejects.toBeDefined();
        expect(notificationService.error).not.toHaveBeenCalled();

        const create = finance.createCategory({ groupId: 'g', name: 'Dup' } as never);
        http.expectOne('/api/v1/categories').flush(
            { message: 'A category with that name already exists.' },
            { status: 400, statusText: 'Bad Request' }
        );
        expect(await create).toBeUndefined();
        expect(notificationService.error).toHaveBeenCalledWith('A category with that name already exists.');
    });
});
