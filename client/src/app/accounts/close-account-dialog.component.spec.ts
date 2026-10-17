import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';
import { Account } from '@shared/finance/types';
import { DateProviderService } from './../core/date-provider.service';
import { NotificationService } from './../core/notification.service';
import { FinanceService } from './../common/finance.service';
import { CloseAccountDialogComponent } from './close-account-dialog.component';

// Tests run with TZ=America/New_York (vitest-base.config.mjs), where a date read as UTC midnight is the day before.
describe('CloseAccountDialogComponent', () => {
    const account: Account = {
        id: 'acc-1',
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1),
        institutionId: 'inst-1',
        name: 'Savings',
        type: AccountType.Savings,
        group: AccountGroup.Cash,
        category: AccountCategory.Asset,
        balance: 500,
        balanceDate: '2026-05-10'
    };

    // The server answers with the closed account, or nothing when it refuses.
    async function render(refused = false) {
        const closed = refused ? undefined : { ...account, closedOn: '2026-05-17' };
        const financeService = { closeAccount: vi.fn().mockResolvedValue(closed) };
        const dialogRef = { close: vi.fn() };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [CloseAccountDialogComponent],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: { account } },
                { provide: MatDialogRef, useValue: dialogRef },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: notificationService },
                {
                    provide: DateProviderService,
                    useValue: { today: () => '2026-05-17', now: () => new Date(2026, 4, 17) }
                }
            ]
        });

        const fixture = TestBed.createComponent(CloseAccountDialogComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const submit = () => element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        return { fixture, element, submit, financeService, dialogRef, notificationService };
    }

    it('ACCT-6.1 should close the account as of today by default, say so, and close', async () => {
        const { fixture, submit, financeService, dialogRef, notificationService } = await render();

        submit().click();
        await fixture.whenStable();

        expect(financeService.closeAccount).toHaveBeenCalledWith('acc-1', '2026-05-17');
        expect(notificationService.success).toHaveBeenCalledWith('Account closed');
        expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('ACCT-6.1 should save an earlier date as YYYY-MM-DD and say that later entries go', async () => {
        const { fixture, element, submit, financeService } = await render();

        expect(element.querySelector('.removal-note')).toBeNull();
        fixture.componentInstance.form.controls.closedOn.setValue(new Date(2026, 4, 1));
        await fixture.whenStable();
        submit().click();
        await fixture.whenStable();

        expect(element.querySelector('.removal-note')!.textContent).toContain('through May 10, 2026');
        expect(financeService.closeAccount).toHaveBeenCalledWith('acc-1', '2026-05-01');
    });

    it('APP-8.1 should not close on a date after today', async () => {
        const { fixture, element, submit } = await render();

        fixture.componentInstance.form.controls.closedOn.setValue(new Date(2026, 4, 18));
        fixture.componentInstance.form.controls.closedOn.markAsTouched();
        await fixture.whenStable();

        expect(submit().disabled).toBe(true);
        expect(element.textContent).toContain("Closed on can't be after today");
    });

    it('ACCT-6.1 should stay open when the server refuses', async () => {
        const { fixture, submit, dialogRef, notificationService } = await render(true);

        submit().click();
        await fixture.whenStable();

        expect(dialogRef.close).not.toHaveBeenCalled();
        expect(notificationService.success).not.toHaveBeenCalled();
    });
});
