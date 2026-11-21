import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';
import { Account, Institution } from '@shared/finance/types';
import { AuthService } from './../core/auth.service';
import { DateProviderService } from './../core/date-provider.service';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { FinanceService } from './../common/finance.service';
import { AccountFormComponent } from './account-form.component';
import { CloseAccountDialogComponent } from './close-account-dialog.component';
import { ManageAccountComponent } from './manage-account.component';

describe('ManageAccountComponent', () => {
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
            closedOn: null,
            ...changes
        };
    }

    const institutions = [
        { id: 'inst-1', name: 'First Bank', createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 1) }
    ] as Institution[];

    // `accounts` are what fetchAccount answers, in turn: the first load, then each reload.
    async function render(...accounts: Account[]) {
        const fetchAccount = vi.fn();
        accounts.forEach(a => fetchAccount.mockResolvedValueOnce(a));
        fetchAccount.mockResolvedValue(accounts[accounts.length - 1]);
        const financeService = {
            fetchAccount,
            fetchInstitutions: vi.fn().mockResolvedValue(institutions),
            saveAccount: vi.fn().mockResolvedValue(accounts[0]),
            reopenAccount: vi.fn().mockResolvedValue(accounts[0]),
            deleteAccount: vi.fn().mockResolvedValue(true)
        };
        const modalService = {
            open: vi.fn().mockResolvedValue(true),
            confirm: vi.fn().mockResolvedValue(true),
            confirmDiscard: vi.fn().mockResolvedValue(true)
        };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [ManageAccountComponent],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: convertToParamMap({ accountId: 'acc-1' }) } }
                },
                { provide: FinanceService, useValue: financeService },
                { provide: ModalService, useValue: modalService },
                { provide: NotificationService, useValue: notificationService },
                { provide: AuthService, useValue: { currentUser: signal(null) } },
                {
                    provide: DateProviderService,
                    useValue: { today: () => '2026-05-17', now: () => new Date(2026, 4, 17) }
                }
            ]
        });

        const fixture = TestBed.createComponent(ManageAccountComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
        const form = () =>
            fixture.debugElement.query(By.directive(AccountFormComponent)).componentInstance as AccountFormComponent;
        const button = (text: string) =>
            Array.from(element.querySelectorAll<HTMLButtonElement>('button')).find(b => b.textContent!.trim() === text);
        const click = async (text: string) => {
            button(text)!.click();
            await fixture.whenStable();
        };
        return { fixture, element, form, button, click, navigate, financeService, modalService, notificationService };
    }

    it('ACCT-7.1 should show Details, then Close or delete', async () => {
        const { element } = await render(account());

        const headings = Array.from(element.querySelectorAll('h2')).map(h => h.textContent!.trim());
        expect(headings).toEqual(['Details', 'Close or delete']);
        expect(element.textContent).toContain('Manage Account');
    });

    it('ACCT-1.5 ACCT-7.2 should save Details without a balance, say so, and return to Account Details', async () => {
        const { fixture, form, click, navigate, financeService, notificationService } = await render(account());

        form().accountForm.controls.name.setValue('Joint Checking');
        form().accountForm.markAsDirty();
        await fixture.whenStable();
        await click('Save');

        expect(financeService.saveAccount).toHaveBeenCalledWith('acc-1', {
            institutionId: 'inst-1',
            name: 'Joint Checking',
            type: AccountType.Checking,
            isHidden: false
        });
        expect(notificationService.success).toHaveBeenCalledWith('Account saved');
        expect(navigate).toHaveBeenCalledWith(['/accounts', 'acc-1']);
        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('ACCT-6.1 ACCT-7.4 should close an open account and then offer to reopen it', async () => {
        const { click, button, modalService, financeService } = await render(
            account(),
            account({ closedOn: '2026-05-17', balance: 0 })
        );

        expect(button('Reopen account')).toBeUndefined();
        await click('Close account');

        expect(modalService.open).toHaveBeenCalledWith(CloseAccountDialogComponent, { account: account() });
        expect(financeService.fetchAccount).toHaveBeenCalledTimes(2);
        expect(button('Close account')).toBeUndefined();
        expect(button('Reopen account')).toBeDefined();
    });

    it('ACCT-6.3 ACCT-7.4 should reopen a closed account after confirming, and say so', async () => {
        const { element, click, modalService, financeService, notificationService } = await render(
            account({ closedOn: '2026-05-01', balance: 0 }),
            account()
        );

        expect(element.textContent).toContain('Closed on May 1, 2026');
        await click('Reopen account');

        expect(modalService.confirm).toHaveBeenCalledWith(expect.objectContaining({ title: 'Reopen Account' }));
        expect(financeService.reopenAccount).toHaveBeenCalledWith('acc-1');
        expect(notificationService.success).toHaveBeenCalledWith('Account reopened');
    });

    it('ACCT-6.3 should leave a closed account closed when reopening is cancelled', async () => {
        const { click, modalService, financeService } = await render(account({ closedOn: '2026-05-01' }));
        modalService.confirm.mockResolvedValue(false);

        await click('Reopen account');

        expect(financeService.reopenAccount).not.toHaveBeenCalled();
    });

    it('ACCT-1.6 should delete after confirming, pointing an open account to closing, and open the Dashboard', async () => {
        const { click, modalService, financeService, notificationService, navigate } = await render(account());

        await click('Delete account');

        expect(modalService.confirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Delete Account',
                message: expect.stringMatching(/close it instead\.$/),
                isWarn: true
            })
        );
        expect(financeService.deleteAccount).toHaveBeenCalledWith('acc-1');
        expect(notificationService.success).toHaveBeenCalledWith('Account deleted');
        expect(navigate).toHaveBeenCalledWith(['/dashboard']);
    });

    it('ACCT-1.6 should not point a closed account to closing', async () => {
        const { click, modalService } = await render(account({ closedOn: '2026-05-01' }));

        await click('Delete account');

        expect(modalService.confirm).toHaveBeenCalledWith(
            expect.objectContaining({ message: expect.not.stringContaining('close it instead') })
        );
    });

    it('ACCT-7.2 APP-2.7 should confirm unsaved Details before an action, and keep them if the user keeps editing', async () => {
        const { fixture, form, click, modalService, financeService } = await render(account());
        form().accountForm.controls.name.setValue('Joint Checking');
        form().accountForm.markAsDirty();
        await fixture.whenStable();

        modalService.confirmDiscard.mockResolvedValueOnce(false);
        await click('Delete account');
        expect(modalService.confirm).not.toHaveBeenCalled();
        expect(form().accountForm.controls.name.value).toBe('Joint Checking');

        await click('Delete account');
        expect(modalService.confirmDiscard).toHaveBeenCalledTimes(2);
        expect(form().accountForm.controls.name.value).toBe('Checking');
        expect(financeService.deleteAccount).toHaveBeenCalled();
    });

    it('ACCT-7.2 should not ask about Details when they have no changes', async () => {
        const { click, modalService } = await render(account());

        await click('Close account');

        expect(modalService.confirmDiscard).not.toHaveBeenCalled();
        expect(modalService.open).toHaveBeenCalled();
    });
});
