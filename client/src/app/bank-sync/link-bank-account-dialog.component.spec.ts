import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
    AccountCategory,
    AccountGroup,
    AccountType,
    BankAccountAction,
    BankAccountLinkStatus
} from '@shared/finance/enum';
import { Account, BankAccount } from '@shared/finance/types';
import { NotificationService } from './../core/notification.service';
import { BankSyncService } from './bank-sync.service';
import { LinkBankAccountDialogComponent } from './link-bank-account-dialog.component';

describe('LinkBankAccountDialogComponent', () => {
    const account: Account = {
        id: 'acc-holiday',
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1),
        institutionId: 'inst-harbor',
        name: 'Holiday Fund',
        type: AccountType.Savings,
        group: AccountGroup.Cash,
        category: AccountCategory.Asset,
        isManual: true
    };

    function bankAccount(changes: Partial<BankAccount>): BankAccount {
        return {
            id: 'ba',
            connectionId: 'conn-harbor',
            connectionName: 'Harbor Community Bank',
            name: 'Bank account',
            currency: 'USD',
            canLink: true,
            balance: 100,
            availableBalance: null,
            balanceDate: new Date(2026, 10, 21),
            linkStatus: BankAccountLinkStatus.NotSetUp,
            linkedAccount: null,
            missingSince: null,
            lastSyncedAt: null,
            syncFrom: null,
            ...changes
        };
    }

    const bankAccounts = [
        bankAccount({ id: 'ba-holiday', name: 'Holiday Fund' }),
        bankAccount({ id: 'ba-savings', name: 'High-Yield Savings', linkStatus: BankAccountLinkStatus.Ignored }),
        bankAccount({ id: 'ba-mortgage', connectionId: 'conn-lakeside', connectionName: 'Lakeside', name: 'Mortgage' })
    ];

    async function render(refused = false) {
        const bankSyncService = {
            updateBankAccount: vi
                .fn()
                .mockResolvedValue(refused ? undefined : { bankAccount: bankAccounts[0], transactionsAdded: 1 }),
            fetchSyncFromDefault: vi.fn().mockResolvedValue('2026-11-02')
        };
        const dialogRef = { close: vi.fn() };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [LinkBankAccountDialogComponent],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: { account, bankAccounts } },
                { provide: MatDialogRef, useValue: dialogRef },
                { provide: BankSyncService, useValue: bankSyncService },
                { provide: NotificationService, useValue: notificationService }
            ]
        });

        const fixture = TestBed.createComponent(LinkBankAccountDialogComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const submit = () => element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        return { fixture, submit, bankSyncService, dialogRef, notificationService };
    }

    it('ACCT-7.3 should offer the bank accounts it was given, by connection', async () => {
        const { fixture } = await render();

        expect(fixture.componentInstance.connections.map(c => [c.name, c.bankAccounts.map(b => b.name)])).toEqual([
            ['Harbor Community Bank', ['Holiday Fund', 'High-Yield Savings']],
            ['Lakeside', ['Mortgage']]
        ]);
    });

    it('ACCT-7.3 SYNC-2.4 should default Sync transactions from for the chosen bank account and link', async () => {
        const { fixture, submit, bankSyncService, dialogRef, notificationService } = await render();
        const controls = fixture.componentInstance.form.controls;

        expect(submit().disabled).toBe(true);
        controls.bankAccountId.setValue('ba-holiday');
        await fixture.whenStable();
        expect(bankSyncService.fetchSyncFromDefault).toHaveBeenCalledWith('ba-holiday', 'acc-holiday');
        expect(controls.syncFrom.value).toEqual(new Date(2026, 10, 2));
        submit().click();
        await fixture.whenStable();

        expect(bankSyncService.updateBankAccount).toHaveBeenCalledWith('ba-holiday', {
            action: BankAccountAction.Link,
            accountId: 'acc-holiday',
            syncFrom: '2026-11-02'
        });
        expect(notificationService.success).toHaveBeenCalledWith('Account linked: 1 transaction added');
        expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('APP-2.6 should stay open when the server refuses', async () => {
        const { fixture, submit, dialogRef } = await render(true);

        fixture.componentInstance.form.controls.bankAccountId.setValue('ba-holiday');
        await fixture.whenStable();
        submit().click();
        await fixture.whenStable();

        expect(dialogRef.close).not.toHaveBeenCalled();
    });
});
