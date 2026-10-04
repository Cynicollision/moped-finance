import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Account, Transaction } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';
import { AddTransactionComponent } from './add-transaction.component';
import { TransactionFormComponent } from './transaction-form.component';

describe('AddTransactionComponent', () => {
    const accounts = [{ id: 'acct', name: 'Checking', isHidden: false }] as Account[];

    async function render(queryParams: Record<string, string>, created: Transaction | undefined) {
        const financeService = {
            fetchCategories: vi.fn().mockResolvedValue([]),
            fetchAllAccounts: vi.fn().mockResolvedValue(accounts),
            createTransaction: vi.fn().mockResolvedValue(created)
        };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [AddTransactionComponent],
            providers: [
                provideRouter([]),
                { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(queryParams) } } },
                {
                    provide: DateProviderService,
                    useValue: { now: () => new Date(2026, 4, 17), today: () => '2026-05-17' }
                },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: notificationService }
            ]
        });
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

        const fixture = TestBed.createComponent(AddTransactionComponent);
        await fixture.whenStable();
        const form = fixture.debugElement.query(debug => debug.componentInstance instanceof TransactionFormComponent)
            .componentInstance as TransactionFormComponent;

        const submit = async () => {
            (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(new Event('submit'));
            await fixture.whenStable();
        };
        return { fixture, form: form.transactionForm, submit, financeService, notificationService, navigate };
    }

    it('TXN-2.1 should pre-select the account it was opened from', async () => {
        const { form } = await render({ accountId: 'acct' }, undefined);

        expect(form.controls.accountId.value).toBe('acct');
    });

    it('TXN-2.1 TXN-2.7 should create the transaction, Uncategorized when no category is chosen, then say so', async () => {
        const { fixture, form, submit, financeService, notificationService, navigate } = await render({}, {
            id: 't1'
        } as Transaction);
        form.patchValue({ accountId: 'acct', amount: -12.5, merchant: 'Bakery' });
        form.markAsDirty();
        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);

        await submit();

        expect(financeService.createTransaction).toHaveBeenCalledWith({
            accountId: 'acct',
            categoryId: '',
            date: '2026-05-17',
            amount: -12.5,
            merchant: 'Bakery',
            originalStatement: '',
            notes: '',
            isHidden: false,
            isSplit: false,
            splitParentId: ''
        });
        expect(notificationService.success).toHaveBeenCalledWith('Transaction added');
        expect(navigate).toHaveBeenCalledWith(['/transactions']);
        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('APP-2.2 APP-2.7 should stay on the form when the server refuses', async () => {
        const { fixture, form, submit, notificationService, navigate } = await render({}, undefined);
        form.patchValue({ accountId: 'acct', amount: -12.5, merchant: 'Bakery' });
        form.markAsDirty();

        await submit();

        expect(notificationService.success).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    });

    it('should not submit without an account', async () => {
        const { form, submit, financeService } = await render({}, undefined);
        form.patchValue({ amount: -12.5, merchant: 'Bakery' });

        await submit();

        expect(financeService.createTransaction).not.toHaveBeenCalled();
    });
});
