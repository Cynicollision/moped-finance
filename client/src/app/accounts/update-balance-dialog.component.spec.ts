import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';
import { Account } from '@shared/finance/types';
import { DateProviderService } from './../core/date-provider.service';
import { NotificationService } from './../core/notification.service';
import { FinanceService } from './../common/finance.service';
import { UpdateBalanceDialogComponent } from './update-balance-dialog.component';

describe('UpdateBalanceDialogComponent', () => {
    function account(changes: Partial<Account> = {}): Account {
        return {
            id: 'acc-1',
            createdAt: new Date(2026, 0, 1),
            updatedAt: new Date(2026, 0, 1),
            institutionId: 'inst-1',
            name: 'Checking',
            type: AccountType.Checking,
            group: AccountGroup.Cash,
            category: AccountCategory.Asset,
            isHidden: false,
            isManual: true,
            balance: 1200,
            balanceDate: '2026-05-01',
            ...changes
        };
    }

    // The server answers with the account, or nothing when it refuses.
    async function render(existing: Account, refused = false) {
        const financeService = { saveAccount: vi.fn().mockResolvedValue(refused ? undefined : existing) };
        const dialogRef = { close: vi.fn() };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [UpdateBalanceDialogComponent],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: { account: existing } },
                { provide: MatDialogRef, useValue: dialogRef },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: notificationService },
                {
                    provide: DateProviderService,
                    useValue: { today: () => '2026-05-17', now: () => new Date(2026, 4, 17) }
                }
            ]
        });

        const fixture = TestBed.createComponent(UpdateBalanceDialogComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const dialog = fixture.componentInstance;
        const submit = () => element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        const label = () => element.querySelector('mat-label')!.textContent!.trim();
        return { fixture, element, dialog, submit, label, financeService, dialogRef, notificationService };
    }

    it('ACCT-7.5 should start at the current balance and save only the balance as of today', async () => {
        const { fixture, dialog, submit, label, financeService, dialogRef, notificationService } =
            await render(account());

        expect(label()).toBe('Balance');
        expect(dialog.form.controls.balance.value).toBe(1200);
        dialog.form.controls.balance.setValue(1350.5);
        await fixture.whenStable();
        submit().click();
        await fixture.whenStable();

        expect(financeService.saveAccount).toHaveBeenCalledWith('acc-1', {
            balanceEntry: { date: '2026-05-17', balance: 1350.5 }
        });
        expect(notificationService.success).toHaveBeenCalledWith('Balance updated');
        expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it("APP-6.3 should ask for a liability's Amount owed and save it negative", async () => {
        const { fixture, dialog, submit, label, financeService } = await render(
            account({ type: AccountType.CreditCard, group: AccountGroup.CreditCards, balance: -450.25 })
        );

        expect(label()).toBe('Amount owed');
        expect(dialog.form.controls.balance.value).toBe(450.25);
        dialog.form.controls.balance.setValue(300);
        await fixture.whenStable();
        submit().click();
        await fixture.whenStable();

        expect(financeService.saveAccount).toHaveBeenCalledWith('acc-1', {
            balanceEntry: { date: '2026-05-17', balance: -300 }
        });
    });

    it('ACCT-2.2 should start blank for an account with no balance yet, and need one to save', async () => {
        const { dialog, submit } = await render(account({ balance: 0, balanceDate: null }));

        expect(dialog.form.controls.balance.value).toBeNull();
        expect(submit().disabled).toBe(true);
    });

    it('ACCT-7.5 should stay open when the server refuses', async () => {
        const { fixture, submit, dialogRef, notificationService } = await render(account(), true);

        submit().click();
        await fixture.whenStable();

        expect(dialogRef.close).not.toHaveBeenCalled();
        expect(notificationService.success).not.toHaveBeenCalled();
    });

    it('APP-2.7 should have unsaved changes once the balance is edited, and none once saved', async () => {
        const { fixture, dialog, submit } = await render(account());

        expect(dialog.hasUnsavedChanges()).toBe(false);
        dialog.form.controls.balance.setValue(1300);
        dialog.form.markAsDirty();
        expect(dialog.hasUnsavedChanges()).toBe(true);
        submit().click();
        await fixture.whenStable();

        expect(dialog.hasUnsavedChanges()).toBe(false);
    });
});
