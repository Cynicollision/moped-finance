import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';
import { Account, Institution } from '@shared/finance/types';
import { ModalService } from './../core/modal/modal.service';
import { FinanceService } from './../common/finance.service';
import { InstitutionsComponent } from './institutions.component';

describe('InstitutionsComponent', () => {
    const institution = { id: 'inst-1', name: 'Harbor Community Bank' } as Institution;

    function account(changes: Partial<Account>): Account {
        return {
            id: 'acc',
            createdAt: new Date(2026, 0, 1),
            updatedAt: new Date(2026, 0, 1),
            institutionId: 'inst-1',
            name: 'Account',
            type: AccountType.Checking,
            group: AccountGroup.Cash,
            category: AccountCategory.Asset,
            isManual: true,
            ...changes
        };
    }

    async function render(institutions: Institution[] = [], accounts: Account[] = []) {
        TestBed.configureTestingModule({
            imports: [InstitutionsComponent],
            providers: [
                provideRouter([]),
                {
                    provide: FinanceService,
                    useValue: {
                        fetchInstitutions: vi.fn().mockResolvedValue(institutions),
                        fetchAllAccounts: vi.fn().mockResolvedValue(accounts)
                    }
                },
                { provide: ModalService, useValue: { open: vi.fn() } }
            ]
        });
        const fixture = TestBed.createComponent(InstitutionsComponent);
        await fixture.whenStable();
        return { fixture, element: fixture.nativeElement as HTMLElement };
    }

    it('INST-1.10 should offer Add Institution and Add Account in the header menu, with no header button', async () => {
        const { fixture, element } = await render();

        expect(element.querySelector('app-page-header .page-action')).toBeNull();

        element.querySelector<HTMLButtonElement>('app-page-header [aria-label="More options"]')!.click();
        await fixture.whenStable();

        const items = Array.from(document.querySelectorAll('.mat-mdc-menu-item'));
        expect(items.map(item => item.textContent!.trim())).toEqual([
            'account_balanceAdd Institution',
            'addAdd Account'
        ]);
        expect(items[1].getAttribute('href')).toBe('/accounts/new');
    });

    it('INST-1.12 should mark connected accounts with a sync icon and Synced', async () => {
        const { element } = await render(
            [institution],
            [
                account({ id: 'acc-1', name: 'Everyday Checking', isManual: false }),
                account({ id: 'acc-2', name: 'Cash' })
            ]
        );

        const rows = Array.from(element.querySelectorAll('.account-row'));
        const synced = rows.map(row => row.querySelector('.synced-label')?.textContent!.replace(/\s+/g, ' ').trim());
        expect(synced).toEqual(['sync Synced', undefined]);
    });
});
