import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { BankSyncWording } from '@shared/finance/contracts';
import { BankSyncAlertKind, BankSyncPauseReason } from '@shared/finance/enum';
import { BankSyncAlert } from '@shared/finance/types';
import { BankSyncBannerComponent, newBankAccountsText } from './bank-sync-banner.component';

describe('BankSyncBannerComponent', () => {
    async function render(alerts: BankSyncAlert[], showLink = false): Promise<HTMLElement> {
        TestBed.configureTestingModule({ imports: [BankSyncBannerComponent], providers: [provideRouter([])] });
        const fixture = TestBed.createComponent(BankSyncBannerComponent);
        fixture.componentRef.setInput('alerts', alerts);
        fixture.componentRef.setInput('showLink', showLink);
        await fixture.whenStable();
        return fixture.nativeElement as HTMLElement;
    }

    it('SYNC-5.1 should show nothing without alerts', async () => {
        const element = await render([]);

        expect(element.textContent!.trim()).toBe('');
    });

    it('SYNC-5.1 should give one line for each alert, in the order the server sends them', async () => {
        const element = await render(
            [
                { kind: BankSyncAlertKind.Paused, reason: BankSyncPauseReason.Refused },
                { kind: BankSyncAlertKind.Failed, failure: "The SimpleFIN server didn't answer in time." },
                { kind: BankSyncAlertKind.Message, text: 'Sign in to Summit Credit Union again.' },
                { kind: BankSyncAlertKind.NoRecentSync, since: new Date(2026, 10, 20, 17, 17) },
                { kind: BankSyncAlertKind.NewBankAccounts, count: 1 }
            ],
            true
        );

        expect(element.querySelector('h2')!.textContent).toBe('Bank sync needs attention');
        expect([...element.querySelectorAll('li')].map(li => li.textContent!.trim())).toEqual([
            BankSyncWording.paused.refused,
            "The last sync failed. The SimpleFIN server didn't answer in time.",
            'SimpleFIN: Sign in to Summit Credit Union again.',
            'No sync has succeeded since Nov 20, 5:17 PM.',
            '1 new bank account found'
        ]);
        expect(element.querySelector('a')!.textContent!.trim()).toBe('Open Bank Sync');
    });

    it("SYNC-5.2 should show the SimpleFIN server's words as plain text, labelled as SimpleFIN's", async () => {
        const element = await render([{ kind: BankSyncAlertKind.Message, text: '<b>Sign in</b> again' }]);

        const line = element.querySelector('li')!;
        expect(line.textContent!.trim()).toBe('SimpleFIN: <b>Sign in</b> again');
        expect(line.querySelector('b')).toBeNull();
        expect(element.textContent).not.toContain('Bridge');
    });

    it('SYNC-5.1 should count new bank accounts in the singular and plural', () => {
        expect(newBankAccountsText(1)).toBe('1 new bank account found');
        expect(newBankAccountsText(2)).toBe('2 new bank accounts found');
    });
});
