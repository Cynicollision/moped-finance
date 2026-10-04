import { TestBed } from '@angular/core/testing';
import { Mock } from 'vitest';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Transaction } from '@shared/finance/types';
import { DateProviderService } from './../../core/date-provider.service';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';
import { ViewTransactionComponent } from './view-transaction.component';

describe('ViewTransactionComponent', () => {
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
        isSplit: false,
        splitParentId: '',
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1)
    };

    // Renders Transaction Details once it has loaded, unless `loaded` is false.
    async function render(
        fetchTransaction: Mock = vi.fn().mockResolvedValue(transaction),
        options: { confirm?: boolean; deleted?: boolean; loaded?: boolean } = {}
    ) {
        const financeService = {
            fetchTransaction,
            fetchCategories: vi.fn().mockResolvedValue([]),
            fetchAllAccounts: vi.fn().mockResolvedValue([]),
            deleteTransaction: vi.fn().mockResolvedValue(options.deleted ?? true)
        };
        const modalService = { confirm: vi.fn().mockResolvedValue(options.confirm ?? true) };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [ViewTransactionComponent],
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
                { provide: MATERIAL_ANIMATIONS, useValue: { animationsDisabled: true } },
                { provide: FinanceService, useValue: financeService },
                { provide: ModalService, useValue: modalService },
                { provide: NotificationService, useValue: notificationService }
            ]
        });
        const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

        const fixture = TestBed.createComponent(ViewTransactionComponent);
        if (options.loaded ?? true) {
            await fixture.whenStable();
        } else {
            fixture.detectChanges();
        }
        return {
            fixture,
            element: fixture.nativeElement as HTMLElement,
            financeService,
            modalService,
            notificationService,
            navigate
        };
    }

    async function chooseFromMenu(fixture: Awaited<ReturnType<typeof render>>['fixture'], label: string) {
        const element = fixture.nativeElement as HTMLElement;
        element.querySelector<HTMLButtonElement>('button[aria-label="More options"]')!.click();
        await fixture.whenStable();
        const item = Array.from(document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item')).find(button =>
            button.textContent!.includes(label)
        )!;
        item.click();
        await fixture.whenStable();
    }

    it('TXN-2.2 APP-2.1 should show placeholders, then the transaction read-only', async () => {
        let resolve!: (t: Transaction) => void;
        const { fixture, element, financeService } = await render(
            vi.fn().mockReturnValue(new Promise(r => (resolve = r))),
            { loaded: false }
        );

        expect(element.querySelector('app-card-skeleton')).not.toBeNull();
        expect(element.querySelector('app-transaction-form')).toBeNull();

        resolve(transaction);
        await fixture.whenStable();

        expect(financeService.fetchTransaction).toHaveBeenCalledWith('t1');
        expect(element.querySelector('app-card-skeleton')).toBeNull();
        expect(element.querySelector('app-transaction-form')!.textContent).toContain('Corner Shop');
        expect(element.querySelector('form button[type="submit"]')).toBeNull();
    });

    it("APP-2.9 should say when the transaction can't be loaded, and load it again on Retry", async () => {
        const { fixture, element, financeService } = await render(
            vi.fn().mockRejectedValue(new Error('Transaction not found.'))
        );

        expect(element.querySelector('app-load-error')).not.toBeNull();

        financeService.fetchTransaction.mockResolvedValue(transaction);
        element.querySelector<HTMLButtonElement>('app-load-error button')!.click();
        await fixture.whenStable();

        expect(financeService.fetchTransaction).toHaveBeenCalledTimes(2);
        expect(element.querySelector('app-load-error')).toBeNull();
        expect(element.querySelector('app-transaction-form')).not.toBeNull();
    });

    it('TXN-2.3 should open Edit Transaction from the menu', async () => {
        const { fixture, navigate } = await render();

        await chooseFromMenu(fixture, 'Edit');

        expect(navigate).toHaveBeenCalledWith(['/transactions', 't1', 'edit']);
    });

    it('TXN-2.4 APP-2.8 should delete after confirming, say so and return to Transactions', async () => {
        const { fixture, financeService, modalService, notificationService, navigate } = await render();

        await chooseFromMenu(fixture, 'Delete');

        expect(modalService.confirm).toHaveBeenCalledWith(
            expect.objectContaining({
                title: 'Delete Transaction',
                message: "Delete this transaction? This can't be undone.",
                confirmLabel: 'Delete'
            })
        );
        expect(financeService.deleteTransaction).toHaveBeenCalledWith('t1');
        expect(notificationService.success).toHaveBeenCalledWith('Transaction deleted');
        expect(navigate).toHaveBeenCalledWith(['/transactions']);
    });

    it('TXN-2.4 should keep the transaction when the confirmation is cancelled', async () => {
        const { fixture, financeService, navigate } = await render(undefined, { confirm: false });

        await chooseFromMenu(fixture, 'Delete');

        expect(financeService.deleteTransaction).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });

    it('APP-2.2 should stay on the transaction when the server refuses the delete', async () => {
        const { fixture, notificationService, navigate } = await render(undefined, { deleted: false });

        await chooseFromMenu(fixture, 'Delete');

        expect(notificationService.success).not.toHaveBeenCalled();
        expect(navigate).not.toHaveBeenCalled();
    });
});
