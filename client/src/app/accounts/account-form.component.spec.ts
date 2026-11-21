import { TestBed } from '@angular/core/testing';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';
import { Account, AccountRequest } from '@shared/finance/types';
import { DateProviderService } from './../core/date-provider.service';
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

    function offeredCategories(form: AccountFormComponent): AccountCategory[] {
        return [...new Set(form.typeGroups().map(info => info.category))];
    }

    it("ACCT-1.13 should offer only the types on an edited account's side", async () => {
        const asset = await renderEdit(account());
        expect(offeredCategories(asset.form)).toEqual([AccountCategory.Asset]);

        TestBed.resetTestingModule();
        const liability = await renderEdit(
            account({ type: AccountType.CreditCard, group: AccountGroup.CreditCards, balance: -450.25 })
        );
        expect(offeredCategories(liability.form)).toEqual([AccountCategory.Liability]);
    });

    it('ACCT-1.13 should offer every type when adding an account', async () => {
        TestBed.configureTestingModule({ imports: [AccountFormComponent] });
        const fixture = TestBed.createComponent(AccountFormComponent);
        await fixture.whenStable();

        expect(offeredCategories(fixture.componentInstance)).toEqual([
            AccountCategory.Asset,
            AccountCategory.Liability
        ]);
    });

    it('ACCT-1.5 ACCT-7.2 should leave the balance out of Details, saving only the fields', async () => {
        const { form, element, saved } = await renderEdit(account());

        form.accountForm.controls.name.setValue('Joint Checking');
        form.accountForm.controls.name.markAsDirty();
        form.onSubmit();

        expect(labels(element)).not.toContain('Balance');
        expect(labels(element)).not.toContain('Starting Balance');
        expect(saved).toEqual([expect.not.objectContaining({ balanceEntry: expect.anything() })]);
        expect(saved[0].name).toBe('Joint Checking');
    });

    it('APP-2.7 should drop unsaved changes when reset to the saved account', async () => {
        const { form } = await renderEdit(account());

        form.accountForm.controls.name.setValue('Joint Checking');
        form.accountForm.controls.name.markAsDirty();
        form.reset(account());

        expect(form.hasUnsavedChanges()).toBe(false);
        expect(form.accountForm.controls.name.value).toBe('Checking');
    });
});
