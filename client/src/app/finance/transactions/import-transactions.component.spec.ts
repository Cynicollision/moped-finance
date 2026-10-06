import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { TransactionImportResult } from '@shared/finance/contracts';
import { Account } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';
import { ImportTransactionsComponent } from './import-transactions.component';

describe('ImportTransactionsComponent', () => {
    const clean: TransactionImportResult = {
        isValidToImport: true,
        resultMessage: '',
        createdCount: 2,
        failedRowMessages: [],
        uncategorizedCount: 1,
        unmatchedCategories: []
    };

    async function render(dryRun: TransactionImportResult, queryParams: Record<string, string> = {}) {
        const financeService = {
            importTransactions: vi.fn((_form: FormData, isDryRun: boolean) =>
                Promise.resolve(isDryRun ? dryRun : clean)
            ),
            fetchAccount: vi.fn().mockResolvedValue({ id: 'a1', name: 'Checking' } as Account)
        };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [ImportTransactionsComponent],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } }
                },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: notificationService },
                { provide: DateProviderService, useValue: { today: () => '2026-05-17' } }
            ]
        });
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

        const fixture = TestBed.createComponent(ImportTransactionsComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const click = async (label: string) => {
            Array.from(element.querySelectorAll<HTMLButtonElement>('button'))
                .find(b => b.textContent!.trim() === label)!
                .click();
            await fixture.whenStable();
        };
        const validate = async () => {
            const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
            Object.defineProperty(input, 'files', { value: [new File(['Date'], 'transactions.csv')] });
            input.dispatchEvent(new Event('change'));
            await fixture.whenStable();
            await click('Validate Import');
        };
        return { element, click, validate, financeService, notificationService, navigate };
    }

    const crumbs = (element: HTMLElement) =>
        Array.from(element.querySelectorAll('app-page-header .crumbs a')).map(a => a.textContent!.trim());

    it('TXN-3.8 should list the columns the file needs', async () => {
        const { element } = await render(clean);

        expect(element.querySelector('app-csv-import strong')!.textContent).toBe(
            'Date, AccountName, Merchant, CategoryName, Amount, OriginalStatement, Notes, IsHidden'
        );
    });

    it('APP-1.8 should sit below Transactions, or below the account it was opened from', async () => {
        expect(crumbs((await render(clean)).element)).toEqual(['Transactions']);

        TestBed.resetTestingModule();
        expect(crumbs((await render(clean, { accountId: 'a1' })).element)).toEqual(['Dashboard', 'Checking']);
    });

    it('TXN-3.4 should count Uncategorized rows and list category names that match no category', async () => {
        const { element, validate } = await render({
            ...clean,
            createdCount: 20,
            uncategorizedCount: 15,
            unmatchedCategories: [
                { name: 'Groceriez', rowNumbers: [4] },
                { name: 'Mystery', rowNumbers: [2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] }
            ]
        });

        await validate();

        expect(Array.from(element.querySelectorAll('.dry-run-results > ul li')).map(li => li.textContent)).toEqual([
            'Transactions to create: 20',
            'Uncategorized: 15',
            'Rows with errors: 0'
        ]);
        expect(Array.from(element.querySelectorAll('.unmatched-rows li')).map(li => li.textContent)).toEqual([
            "'Groceriez': row 4",
            "'Mystery': rows 2, 3, 5, 6, 7, 8, 9, 10, 11, 12 and 2 more"
        ]);
        expect(element.textContent).toContain('Begin Import');
    });

    it('TXN-3.4 should leave out the category notice when every name matches', async () => {
        const { element, validate } = await render(clean);

        await validate();

        expect(element.querySelector('.unmatched-categories')).toBeNull();
    });

    it('TXN-3.3 APP-2.3 should say how many were created and return to Transactions', async () => {
        const { click, validate, financeService, notificationService, navigate } = await render(clean);
        await validate();

        await click('Begin Import');

        expect(financeService.importTransactions).toHaveBeenLastCalledWith(expect.any(FormData), false, null);
        expect(notificationService.success).toHaveBeenCalledWith('Successfully created 2 transactions.');
        expect(navigate).toHaveBeenCalledWith(['/transactions']);
    });

    it('TXN-3.5 should import into the account it was opened from, and return to it', async () => {
        const { click, validate, financeService, navigate } = await render(clean, { accountId: 'a1' });
        await validate();

        await click('Begin Import');

        expect(financeService.importTransactions).toHaveBeenCalledWith(expect.any(FormData), true, 'a1');
        expect(navigate).toHaveBeenCalledWith(['/accounts', 'a1']);
    });
});
