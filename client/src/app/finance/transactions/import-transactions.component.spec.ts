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
        duplicateCount: 0,
        failedRowMessages: [],
        uncategorizedCount: 1,
        unmatchedCategories: []
    };

    async function render(
        dryRun: TransactionImportResult,
        queryParams: Record<string, string> = {},
        account: Partial<Account> = { id: 'a1', name: 'Checking' }
    ) {
        const financeService = {
            importTransactions: vi.fn((_form: FormData, isDryRun: boolean) =>
                Promise.resolve(isDryRun ? dryRun : clean)
            ),
            fetchAccount: vi.fn().mockResolvedValue(account as Account)
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
        return { fixture, element, click, validate, financeService, notificationService, navigate };
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
            'Already imported: 0',
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

        expect(financeService.importTransactions).toHaveBeenLastCalledWith(expect.any(FormData), false, null, false);
        expect(notificationService.success).toHaveBeenCalledWith('Successfully created 2 transactions.');
        expect(navigate).toHaveBeenCalledWith(['/transactions']);
    });

    it('TXN-3.12 should count the rows already imported, and say how many were skipped', async () => {
        const { element, click, validate, financeService, notificationService } = await render({
            ...clean,
            duplicateCount: 3
        });
        financeService.importTransactions.mockResolvedValue({ ...clean, duplicateCount: 3 });
        await validate();

        expect(element.textContent).toContain('Already imported: 3');
        expect(element.textContent).toContain('It can also have: Id.');

        await click('Begin Import');

        expect(notificationService.success).toHaveBeenCalledWith(
            'Successfully created 2 transactions. Skipped 3 already imported.'
        );
    });

    it('TXN-3.5 should import into the account it was opened from, and return to it', async () => {
        const { click, validate, financeService, navigate } = await render(clean, { accountId: 'a1' });
        await validate();

        await click('Begin Import');

        expect(financeService.importTransactions).toHaveBeenCalledWith(expect.any(FormData), true, 'a1', false);
        expect(navigate).toHaveBeenCalledWith(['/accounts', 'a1']);
    });

    describe('Adjust balances', () => {
        const checkbox = (element: HTMLElement) => element.querySelector<HTMLInputElement>('.adjust-option input');

        it('TXN-3.11 should offer Adjust balances, unchecked, for an import into a manual account, and send it', async () => {
            const manual = { id: 'a1', name: 'Cash', isManual: true };
            const { fixture, element, validate, click, financeService } = await render(
                clean,
                { accountId: 'a1' },
                manual
            );
            await validate();

            expect(checkbox(element)!.checked).toBe(false);
            checkbox(element)!.click();
            await fixture.whenStable();
            await click('Begin Import');

            expect(financeService.importTransactions.mock.calls.map(call => call.slice(1))).toEqual([
                [true, 'a1', false],
                [false, 'a1', true]
            ]);
        });

        it('TXN-3.11 should not offer it without an account, or for a connected or closed one', async () => {
            const cases: [Record<string, string>, Partial<Account>][] = [
                [{}, { id: 'a1', name: 'Cash', isManual: true }],
                [{ accountId: 'a1' }, { id: 'a1', name: 'Synced', isManual: false }],
                [{ accountId: 'a1' }, { id: 'a1', name: 'Old', isManual: true, closedOn: '2026-05-01' }]
            ];
            for (const [queryParams, account] of cases) {
                TestBed.resetTestingModule();
                const { element, validate } = await render(clean, queryParams, account);
                await validate();

                expect(element.querySelector('.dry-run-results')).not.toBeNull();
                expect(checkbox(element)).toBeNull();
            }
        });
    });
});
