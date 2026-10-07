import { TestBed } from '@angular/core/testing';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';
import { Account, AccountRequest } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { AccountFormComponent } from './account-form.component';

describe('AccountFormComponent', () => {
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
            hideFromSpending: false,
            balance: 1200,
            balanceDate: '2026-05-01',
            ...changes
        };
    }

    async function renderEdit(existing: Account) {
        TestBed.configureTestingModule({
            imports: [AccountFormComponent],
            providers: [
                {
                    provide: DateProviderService,
                    useValue: { today: () => '2026-05-17', now: () => new Date(2026, 4, 17) }
                }
            ]
        });
        const fixture = TestBed.createComponent(AccountFormComponent);
        fixture.componentRef.setInput('mode', 'edit');
        fixture.componentRef.setInput('account', existing);
        await fixture.whenStable();

        const saved: AccountRequest[] = [];
        fixture.componentInstance.save.subscribe(request => saved.push(request));
        return { fixture, form: fixture.componentInstance, element: fixture.nativeElement as HTMLElement, saved };
    }

    function labels(element: HTMLElement): string[] {
        return Array.from(element.querySelectorAll('mat-label')).map(label => label.textContent!.trim());
    }

    it("ACCT-2.2 should show a manual account's current balance, as of today", async () => {
        const { form, element } = await renderEdit(account());

        expect(labels(element)).toEqual(expect.arrayContaining(['Balance', 'As of']));
        expect(form.accountForm.controls.balance.value).toBe(1200);
        expect(form.accountForm.controls.balanceDate.value).toEqual(new Date(2026, 4, 17));
    });

    it("APP-6.3 should show a liability's balance as the Amount owed", async () => {
        const { form, element } = await renderEdit(
            account({ type: AccountType.CreditCard, group: AccountGroup.CreditCards, balance: -450.25 })
        );

        expect(labels(element)).toContain('Amount owed');
        expect(form.accountForm.controls.balance.value).toBe(450.25);
    });

    it('ACCT-2.2 should leave the balance blank for an account with none yet', async () => {
        const { form } = await renderEdit(account({ balance: 0, balanceDate: null }));

        expect(form.accountForm.controls.balance.value).toBeNull();
    });

    it('ACCT-1.5 should save no balance when only other fields changed', async () => {
        const { form, saved } = await renderEdit(account());

        form.accountForm.controls.name.setValue('Joint Checking');
        form.accountForm.controls.name.markAsDirty();
        form.onSubmit();

        expect(saved).toEqual([expect.not.objectContaining({ balanceEntry: expect.anything() })]);
        expect(saved[0].name).toBe('Joint Checking');
    });

    it('ACCT-2.2 should save a changed balance as of its date, signed as stored', async () => {
        const { form, saved } = await renderEdit(
            account({ type: AccountType.Mortgage, group: AccountGroup.Loans, balance: -200000 })
        );

        form.accountForm.controls.balance.setValue(199000);
        form.accountForm.controls.balance.markAsDirty();
        form.onSubmit();

        expect(saved[0].balanceEntry).toEqual({ date: '2026-05-17', balance: -199000 });
    });

    it('ACCT-2.2 should save the balance when only its date changed', async () => {
        const { form, saved } = await renderEdit(account());

        form.accountForm.controls.balanceDate.setValue(new Date(2026, 4, 10));
        form.accountForm.controls.balanceDate.markAsDirty();
        form.onSubmit();

        expect(saved[0].balanceEntry).toEqual({ date: '2026-05-10', balance: 1200 });
    });

    it("ACCT-4.4 should not offer a connected account's balance", async () => {
        const { element } = await renderEdit(account({ isManual: false }));

        expect(labels(element)).not.toContain('Balance');
        expect(labels(element)).not.toContain('As of');
    });
});
