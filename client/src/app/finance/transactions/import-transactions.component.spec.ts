import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { TransactionImportResult } from '@shared/finance/contracts';
import { AuthService } from './../../core/auth.service';
import { DateProviderService } from './../../core/date-provider.service';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';
import { ImportTransactionsComponent } from './import-transactions.component';

describe('ImportTransactionsComponent', () => {
    async function render(dryRun: Partial<TransactionImportResult>) {
        const financeService = { importTransactions: vi.fn().mockResolvedValue(dryRun), fetchAccount: vi.fn() };
        TestBed.configureTestingModule({
            imports: [ImportTransactionsComponent],
            providers: [
                provideRouter([]),
                { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: { success: vi.fn() } },
                { provide: AuthService, useValue: { currentUser: signal(null) } },
                { provide: DateProviderService, useValue: { today: () => '2026-05-17' } }
            ]
        });

        const fixture = TestBed.createComponent(ImportTransactionsComponent);
        await fixture.whenStable();
        return { fixture, element: fixture.nativeElement as HTMLElement };
    }

    async function validate(fixture: Awaited<ReturnType<typeof render>>['fixture']) {
        fixture.componentInstance.selectedFile.set(new File(['Date'], 'transactions.csv'));
        await fixture.componentInstance.validateImport();
        await fixture.whenStable();
    }

    it('TXN-3.8 should list the columns the file needs', async () => {
        const { element } = await render({});

        expect(element.querySelector('mat-card-content strong')!.textContent)
            .toBe('Date, AccountName, Merchant, CategoryName, Amount, OriginalStatement, Notes, IsHidden');
    });

    it('TXN-3.4 should count Uncategorized rows and list category names that match no category', async () => {
        const { fixture, element } = await render({
            isValidToImport: true,
            createdCount: 20,
            failedRowMessages: [],
            uncategorizedCount: 15,
            unmatchedCategories: [
                { name: 'Groceriez', rowNumbers: [4] },
                { name: 'Mystery', rowNumbers: [2, 3, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] }
            ]
        });

        await validate(fixture);

        expect(Array.from(element.querySelectorAll('.dry-run-results > ul li')).map(li => li.textContent)).toEqual([
            'Transactions to create: 20', 'Uncategorized: 15', 'Rows with errors: 0'
        ]);
        expect(Array.from(element.querySelectorAll('.unmatched-rows li')).map(li => li.textContent)).toEqual([
            "'Groceriez': row 4",
            "'Mystery': rows 2, 3, 5, 6, 7, 8, 9, 10, 11, 12 and 2 more"
        ]);
        expect(element.textContent).toContain('Begin Import');
    });

    it('TXN-3.4 should leave out the category notice when every name matches', async () => {
        const { fixture, element } = await render({
            isValidToImport: true, createdCount: 2, failedRowMessages: [], uncategorizedCount: 1, unmatchedCategories: []
        });

        await validate(fixture);

        expect(element.querySelector('.unmatched-categories')).toBeNull();
    });

    it('TXN-3.7 should list each failed row, and not offer to import', async () => {
        const { fixture, element } = await render({
            isValidToImport: false,
            resultMessage: 'Found errors in 2 of 5 rows.',
            failedRowMessages: ["Row 2: Amount 'abc' is not a number.", "Row 3: Account name 'Nope Account' not found."]
        });

        await validate(fixture);

        expect(element.querySelector('.validation-error p')!.textContent).toBe('Found errors in 2 of 5 rows.');
        expect(Array.from(element.querySelectorAll('.error-rows li')).map(li => li.textContent)).toEqual([
            "Row 2: Amount 'abc' is not a number.",
            "Row 3: Account name 'Nope Account' not found."
        ]);
        expect(element.textContent).not.toContain('Begin Import');
    });
});
