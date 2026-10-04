import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';
import { Institution } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { AuthService } from './../../core/auth.service';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { InstitutionDialogComponent } from './../institutions/institution-dialog.component';
import { FinanceService } from './../finance.service';
import { AccountFormComponent } from './account-form.component';
import { FinanceAddAccountComponent } from './add-account.component';

describe('FinanceAddAccountComponent', () => {
    function institution(id: string, name: string): Institution {
        return { id, name, createdAt: new Date(2026, 0, 1), updatedAt: new Date(2026, 0, 1) } as Institution;
    }

    async function render(institutions: Institution[], institutionId: string | null = null) {
        const financeService = {
            fetchInstitutions: vi.fn().mockResolvedValue(institutions),
            createAccount: vi.fn().mockResolvedValue({ id: 'new-account' })
        };
        const modalService = { open: vi.fn().mockResolvedValue(true) };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [FinanceAddAccountComponent],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { queryParamMap: convertToParamMap(institutionId ? { institutionId } : {}) } }
                },
                { provide: FinanceService, useValue: financeService },
                { provide: ModalService, useValue: modalService },
                { provide: NotificationService, useValue: notificationService },
                { provide: AuthService, useValue: { currentUser: signal(null) } },
                { provide: DateProviderService, useValue: { today: () => '2026-05-17' } }
            ]
        });

        const fixture = TestBed.createComponent(FinanceAddAccountComponent);
        await fixture.whenStable();
        return {
            fixture,
            element: fixture.nativeElement as HTMLElement,
            financeService,
            modalService,
            notificationService
        };
    }

    function labels(element: HTMLElement): string[] {
        return Array.from(element.querySelectorAll('mat-label, mat-checkbox label')).map(label =>
            label.textContent!.trim()
        );
    }

    it('ACCT-1.3 should go straight to the form, with no Connect option, Manual Account checkbox or Balance field', async () => {
        const { element } = await render([institution('inst-1', 'First Bank')]);

        expect(element.querySelector('app-account-form')).not.toBeNull();
        expect(element.textContent).not.toMatch(/connect|coming soon/i);
        expect(labels(element)).toEqual([
            'Account Name',
            'Institution',
            'Category',
            'Group',
            'Type',
            'Hide Account',
            'Retirement Account',
            'Hide from Spending'
        ]);
    });

    it('ACCT-1.3 should list institutions by name and start at the one it was opened from', async () => {
        const { fixture } = await render(
            [institution('inst-2', 'credit union'), institution('inst-1', 'Big Bank')],
            'inst-2'
        );

        const form = fixture.debugElement.query(By.directive(AccountFormComponent))
            .componentInstance as AccountFormComponent;
        expect(form.institutions().map(i => i.name)).toEqual(['Big Bank', 'credit union']);
        expect(form.accountForm.controls.institutionId.value).toBe('inst-2');
    });

    it('ACCT-1.3 should save a manual account, say so, and open its details', async () => {
        const { fixture, element, financeService, notificationService } = await render(
            [institution('inst-1', 'First Bank')],
            'inst-1'
        );
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

        const form = fixture.debugElement.query(By.directive(AccountFormComponent))
            .componentInstance as AccountFormComponent;
        form.accountForm.controls.name.setValue('Joint Checking');
        await fixture.whenStable();
        element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
        await fixture.whenStable();

        expect(financeService.createAccount).toHaveBeenCalledWith({
            institutionId: 'inst-1',
            name: 'Joint Checking',
            category: AccountCategory.Asset,
            group: AccountGroup.Cash,
            type: AccountType.Checking,
            isHidden: false,
            isManual: true,
            isRetirement: false,
            hideFromSpending: false
        });
        expect(notificationService.success).toHaveBeenCalledWith('Account added');
        expect(navigate).toHaveBeenCalledWith(['/accounts', 'new-account']);
        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('APP-2.7 should have unsaved changes once the form is edited', async () => {
        const { fixture } = await render([institution('inst-1', 'First Bank')]);
        const form = fixture.debugElement.query(By.directive(AccountFormComponent))
            .componentInstance as AccountFormComponent;

        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
        form.accountForm.controls.name.setValue('Joint Checking');
        form.accountForm.markAsDirty();
        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    });

    it('ACCT-1.3 should ask for an institution first when there are none, then show the form', async () => {
        const { fixture, element, financeService, modalService } = await render([]);

        expect(element.querySelector('app-account-form')).toBeNull();

        financeService.fetchInstitutions.mockResolvedValue([institution('inst-1', 'First Bank')]);
        element.querySelector<HTMLButtonElement>('.no-institutions button')!.click();
        await fixture.whenStable();

        expect(modalService.open).toHaveBeenCalledWith(InstitutionDialogComponent, {});
        expect(element.querySelector('app-account-form')).not.toBeNull();
    });
});
