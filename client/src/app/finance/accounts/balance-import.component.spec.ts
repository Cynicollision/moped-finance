import { TestBed } from '@angular/core/testing';
import { Mock } from 'vitest';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { BalanceImportResult } from '@shared/finance/contracts';
import { Account } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';
import { BalanceImportComponent } from './balance-import.component';

describe('BalanceImportComponent', () => {
    const clean: BalanceImportResult = {
        isValidToImport: true,
        resultMessage: '',
        createdCount: 30,
        failedRowMessages: [],
        startDate: '2026-05-01',
        endDate: '2026-05-30'
    };

    async function render(
        dryRun: BalanceImportResult | undefined,
        realRun: BalanceImportResult | undefined = clean,
        fetchAccount: Mock = vi.fn().mockResolvedValue({ id: 'a1', name: 'Checking' } as Account)
    ) {
        const financeService = {
            fetchAccount,
            importBalanceHistory: vi.fn((_id: string, _form: FormData, isDryRun: boolean) =>
                Promise.resolve(isDryRun ? dryRun : realRun)
            )
        };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [BalanceImportComponent],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: convertToParamMap({ accountId: 'a1' }) } }
                },
                { provide: DateProviderService, useValue: { today: () => '2026-05-17' } },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: notificationService }
            ]
        });
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

        const fixture = TestBed.createComponent(BalanceImportComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const button = (label: string) =>
            Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(
                b => b.textContent!.trim() === label
            );
        const click = async (label: string) => {
            button(label)!.click();
            await fixture.whenStable();
        };
        const chooseFile = async () => {
            const input = element.querySelector<HTMLInputElement>('input[type="file"]')!;
            Object.defineProperty(input, 'files', { value: [new File(['Date,Balance'], 'balances.csv')] });
            input.dispatchEvent(new Event('change'));
            await fixture.whenStable();
        };
        return { fixture, element, button, click, chooseFile, financeService, notificationService, navigate };
    }

    it('ACCT-3.8 should sit below the Dashboard and the account, and list the columns the file needs', async () => {
        const { element } = await render(clean);

        expect(
            Array.from(element.querySelectorAll('app-page-header .crumbs a')).map(a => a.textContent!.trim())
        ).toEqual(['Dashboard', 'Checking']);
        expect(element.querySelector('app-csv-import strong')!.textContent).toBe('Date, AccountName, Balance');
    });

    it('ACCT-3.8 should say "Account" in the breadcrumb if the account can\'t be loaded', async () => {
        const { element } = await render(clean, clean, vi.fn().mockRejectedValue(new Error('nope')));

        expect(
            Array.from(element.querySelectorAll('app-page-header .crumbs a')).map(a => a.textContent!.trim())
        ).toEqual(['Dashboard', 'Account']);
    });

    it('ACCT-3.3 should show what will be replaced', async () => {
        const { element, button, click, chooseFile, financeService } = await render(clean);
        await chooseFile();
        await click('Validate Import');

        expect(financeService.importBalanceHistory).toHaveBeenCalledWith('a1', expect.any(FormData), true);
        expect(element.querySelector('.dry-run-results p')!.textContent!.replace(/\s+/g, ' ').trim()).toBe(
            'This import will replace all existing balance history for this account between 2026-05-01 and 2026-05-30.'
        );
        expect(Array.from(element.querySelectorAll('.dry-run-results li')).map(li => li.textContent)).toEqual([
            'Days of history to import: 30',
            'Rows with errors: 0'
        ]);
        expect(button('Begin Import')).toBeDefined();
    });

    it('ACCT-3.5 APP-2.3 should import on Begin Import, say how many records, and return to the account', async () => {
        const { click, chooseFile, financeService, notificationService, navigate } = await render(clean);
        await chooseFile();
        await click('Validate Import');

        await click('Begin Import');

        expect(financeService.importBalanceHistory).toHaveBeenLastCalledWith('a1', expect.any(FormData), false);
        expect(notificationService.success).toHaveBeenCalledWith('Successfully imported 30 records.');
        expect(navigate).toHaveBeenCalledWith(['/accounts', 'a1']);
    });
});
