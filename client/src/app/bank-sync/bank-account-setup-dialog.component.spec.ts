import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
    AccountCategory,
    AccountGroup,
    AccountType,
    BankAccountAction,
    BankAccountLinkStatus
} from '@shared/finance/enum';
import { Account, BankAccount, Institution } from '@shared/finance/types';
import { NotificationService } from './../core/notification.service';
import { FinanceService } from './../common/finance.service';
import { BankAccountSetupDialogComponent, BankAccountSetupDialogData } from './bank-account-setup-dialog.component';
import { BankSyncService } from './bank-sync.service';

describe('BankAccountSetupDialogComponent', () => {
    const bankAccount: BankAccount = {
        id: 'ba-holiday',
        connectionId: 'conn-harbor',
        connectionName: 'Harbor Community Bank',
        name: 'Holiday Fund',
        currency: 'USD',
        canLink: true,
        balance: 2325,
        availableBalance: null,
        balanceDate: new Date(2026, 10, 21),
        linkStatus: BankAccountLinkStatus.NotSetUp,
        linkedAccount: null,
        missingSince: null,
        lastSyncedAt: null,
        syncFrom: null
    };

    function account(changes: Partial<Account>): Account {
        return {
            id: 'acc',
            createdAt: new Date(2026, 0, 1),
            updatedAt: new Date(2026, 0, 1),
            institutionId: 'inst-harbor',
            name: 'Account',
            type: AccountType.Savings,
            group: AccountGroup.Cash,
            category: AccountCategory.Asset,
            isManual: true,
            ...changes
        };
    }

    const accounts: Account[] = [
        account({ id: 'acc-savings', name: 'savings' }),
        account({ id: 'acc-checking', name: 'Checking', isManual: false }),
        account({ id: 'acc-old', name: 'Old Savings', closedOn: '2026-01-31' }),
        account({ id: 'acc-brokerage', name: 'Brokerage', institutionId: 'inst-northwind' })
    ];

    const institution = (id: string, name: string): Institution =>
        ({ id, name, createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 1) }) as Institution;

    async function render(
        options: { data?: Partial<BankAccountSetupDialogData>; institutions?: Institution[]; refused?: boolean } = {}
    ) {
        const bankSyncService = {
            updateBankAccount: vi
                .fn()
                .mockResolvedValue(options.refused ? undefined : { bankAccount, transactionsAdded: 12 }),
            fetchSyncFromDefault: vi.fn().mockResolvedValue('2026-11-02')
        };
        const financeService = {
            fetchAllAccounts: vi.fn().mockResolvedValue(accounts),
            fetchInstitutions: vi
                .fn()
                .mockResolvedValue(
                    options.institutions ?? [
                        institution('inst-northwind', 'Northwind Investments'),
                        institution('inst-harbor', 'harbor community bank')
                    ]
                )
        };
        const dialogRef = { close: vi.fn() };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [BankAccountSetupDialogComponent],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: { bankAccount, ...options.data } },
                { provide: MatDialogRef, useValue: dialogRef },
                { provide: BankSyncService, useValue: bankSyncService },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: notificationService }
            ]
        });

        const fixture = TestBed.createComponent(BankAccountSetupDialogComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const submit = () => element.querySelector<HTMLButtonElement>('button[type="submit"]')!;
        return { fixture, element, submit, bankSyncService, dialogRef, notificationService };
    }

    it('SYNC-2.1 should offer the three choices when opened from Set up', async () => {
        const { element } = await render();

        const choices = [...element.querySelectorAll('.choice-label')].map(e => e.textContent!.trim());
        expect(choices).toEqual(['Link to an account', 'Create new account', "Don't sync"]);
        expect(element.querySelector('h2')!.textContent).toContain('Set Up Bank Account');
    });

    it("SYNC-2.1 should open on the menu's choice without offering the others", async () => {
        const { element } = await render({ data: { choice: BankAccountAction.Create } });

        expect(element.querySelector('mat-radio-group')).toBeNull();
        expect(element.querySelector('h2')!.textContent).toContain('Create New Account');
        expect(element.querySelector('[formControlName="name"]')).not.toBeNull();
    });

    it('SYNC-2.4 should offer open accounts not linked to another bank account, by name', async () => {
        const { fixture } = await render();

        expect(fixture.componentInstance.linkableAccounts().map(a => a.name)).toEqual(['Brokerage', 'savings']);
    });

    it('SYNC-2.4 should default Sync transactions from for the chosen account and link from it', async () => {
        const { fixture, submit, bankSyncService, dialogRef, notificationService } = await render();
        const link = fixture.componentInstance.linkForm.controls;

        link.accountId.setValue('acc-savings');
        await fixture.whenStable();
        expect(bankSyncService.fetchSyncFromDefault).toHaveBeenCalledWith('ba-holiday', 'acc-savings');
        expect(link.syncFrom.value).toEqual(new Date(2026, 10, 2));

        link.syncFrom.setValue(new Date(2026, 10, 5));
        await fixture.whenStable();
        submit().click();
        await fixture.whenStable();

        expect(bankSyncService.updateBankAccount).toHaveBeenCalledWith('ba-holiday', {
            action: BankAccountAction.Link,
            accountId: 'acc-savings',
            syncFrom: '2026-11-05'
        });
        expect(notificationService.success).toHaveBeenCalledWith('Bank account linked: 12 transactions added');
        expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('SYNC-2.3 should default the name and the institution named like the connection, with no type', async () => {
        const { fixture, submit } = await render({ data: { choice: BankAccountAction.Create } });
        const create = fixture.componentInstance.createForm.controls;

        expect(create.name.value).toBe('Holiday Fund');
        expect(create.institutionId.value).toBe('inst-harbor');
        expect(create.type.value).toBeNull();
        expect(submit().disabled).toBe(true);
    });

    it('SYNC-2.3 should create the account, in a new institution named after the connection when none matches', async () => {
        const { fixture, element, submit, bankSyncService, notificationService } = await render({
            data: { choice: BankAccountAction.Create },
            institutions: [institution('inst-northwind', 'Northwind Investments')]
        });
        const create = fixture.componentInstance.createForm.controls;

        expect(create.institutionId.value).toBe('new');
        create.type.setValue(AccountType.Savings);
        create.isHidden.setValue(true);
        await fixture.whenStable();
        submit().click();
        await fixture.whenStable();

        expect(element.textContent).not.toContain('Bridge');
        expect(bankSyncService.updateBankAccount).toHaveBeenCalledWith('ba-holiday', {
            action: BankAccountAction.Create,
            name: 'Holiday Fund',
            type: AccountType.Savings,
            isHidden: true,
            institutionName: 'Harbor Community Bank'
        });
        expect(notificationService.success).toHaveBeenCalledWith('Account created: 12 transactions added');
    });

    it("SYNC-2.2 should mark it Don't sync", async () => {
        const { fixture, submit, bankSyncService, notificationService } = await render();

        fixture.componentInstance.choice.setValue(BankAccountAction.Ignore);
        await fixture.whenStable();
        expect(submit().textContent!.trim()).toBe("Don't Sync");
        submit().click();
        await fixture.whenStable();

        expect(bankSyncService.updateBankAccount).toHaveBeenCalledWith('ba-holiday', {
            action: BankAccountAction.Ignore
        });
        expect(notificationService.success).toHaveBeenCalledWith("Bank account set to Don't sync");
    });

    it('APP-2.6 should stay open when the server refuses', async () => {
        const { fixture, submit, dialogRef } = await render({ refused: true });

        fixture.componentInstance.choice.setValue(BankAccountAction.Ignore);
        await fixture.whenStable();
        submit().click();
        await fixture.whenStable();

        expect(dialogRef.close).not.toHaveBeenCalled();
    });
});
