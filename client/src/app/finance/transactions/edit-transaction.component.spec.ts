import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Transaction } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';
import { EditTransactionComponent } from './edit-transaction.component';
import { TransactionFormComponent } from './transaction-form.component';

describe('EditTransactionComponent', () => {
    const transaction: Transaction = {
        id: 't1',
        date: '2026-05-01',
        accountId: 'acct',
        categoryId: '',
        amount: -10,
        merchant: 'Corner Shop',
        originalStatement: '',
        notes: '',
        isHidden: false,
        adjustsBalance: false,
        splitId: '',
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1)
    };

    async function render(saveResult: Transaction | undefined) {
        let finishSave!: (t: Transaction | undefined) => void;
        const saved = new Promise<Transaction | undefined>(r => (finishSave = r));
        const financeService = {
            fetchTransaction: vi.fn().mockResolvedValue(transaction),
            fetchCategories: vi.fn().mockResolvedValue([]),
            fetchAllAccounts: vi.fn().mockResolvedValue([]),
            saveTransaction: vi.fn().mockReturnValue(saved)
        };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [EditTransactionComponent],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: { snapshot: { paramMap: convertToParamMap({ transactionId: 't1' }) } }
                },
                {
                    provide: DateProviderService,
                    useValue: { now: () => new Date(2026, 4, 17), today: () => '2026-05-17' }
                },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: notificationService }
            ]
        });
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

        const fixture = TestBed.createComponent(EditTransactionComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const form = fixture.debugElement.query(debug => debug.componentInstance instanceof TransactionFormComponent)
            .componentInstance as TransactionFormComponent;

        // Edits the merchant and submits, leaving the save running until `finish` is called.
        const save = async () => {
            form.transactionForm.controls.merchant.setValue('Corner Shop Ltd');
            form.transactionForm.markAsDirty();
            element.querySelector('form')!.dispatchEvent(new Event('submit'));
            await fixture.whenStable();
            return {
                finish: async () => {
                    finishSave(saveResult);
                    // The component carries on from its own await first, so the change is scheduled by the time this resumes.
                    await saved;
                    await fixture.whenStable();
                }
            };
        };
        return { fixture, element, save, financeService, notificationService, navigate };
    }

    it('TXN-2.3 should save the changed transaction, say so and return to its details', async () => {
        const { fixture, element, save, financeService, notificationService, navigate } = await render(transaction);
        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);

        const saving = await save();

        expect(financeService.saveTransaction).toHaveBeenCalledWith(
            expect.objectContaining({ id: 't1', merchant: 'Corner Shop Ltd', date: '2026-05-01' })
        );
        expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(true);
        expect(element.querySelector('button[type="submit"] .button-spinner')).not.toBeNull();

        await saving.finish();

        expect(notificationService.success).toHaveBeenCalledWith('Transaction saved');
        expect(navigate).toHaveBeenCalledWith(['/transactions', 't1']);
        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(false);
    });

    it('APP-2.2 APP-2.7 should stay on the form, with its changes, when the server refuses', async () => {
        const { fixture, element, save, notificationService, navigate } = await render(undefined);

        await (await save()).finish();

        expect(notificationService.success).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
        expect(element.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
        expect(fixture.componentInstance.hasUnsavedChanges()).toBe(true);
    });

    it("TXN-2.3 should go back to the transaction's details on Cancel", async () => {
        const { element, navigate } = await render(transaction);

        Array.from(element.querySelectorAll<HTMLButtonElement>('form button'))
            .find(b => b.textContent!.trim() === 'Cancel')!
            .click();

        expect(navigate).toHaveBeenCalledWith(['/transactions', 't1']);
    });
});
