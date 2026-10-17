import { TestBed } from '@angular/core/testing';
import { Mock } from 'vitest';
import { of } from 'rxjs';
import { MATERIAL_ANIMATIONS } from '@angular/material/core';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { Transaction } from '@shared/finance/types';
import { DateProviderService } from './../core/date-provider.service';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { FinanceService } from './../common/finance.service';
import { SplitTransactionModalComponent } from './split-transaction-modal.component';
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
        adjustsBalance: false,
        splitId: '',
        createdAt: new Date(2026, 0, 1),
        updatedAt: new Date(2026, 0, 1)
    };

    // Renders Transaction Details once it has loaded, unless `loaded` is false.
    async function render(
        fetchTransaction: Mock = vi.fn().mockResolvedValue(transaction),
        options: { confirm?: boolean; deleted?: boolean; loaded?: boolean; splitParts?: Transaction[] } = {}
    ) {
        const financeService = {
            fetchTransaction,
            fetchTransactionSplit: vi.fn().mockResolvedValue(options.splitParts ?? []),
            fetchCategories: vi.fn().mockResolvedValue([]),
            fetchAllAccounts: vi.fn().mockResolvedValue([]),
            deleteTransaction: vi.fn().mockResolvedValue(options.deleted ?? true),
            unsplitTransaction: vi.fn().mockResolvedValue(true)
        };
        const modalService = {
            confirm: vi.fn().mockResolvedValue(options.confirm ?? true),
            open: vi.fn().mockResolvedValue(undefined)
        };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [ViewTransactionComponent],
            providers: [
                provideRouter([]),
                {
                    provide: ActivatedRoute,
                    useValue: {
                        snapshot: { paramMap: convertToParamMap({ transactionId: 't1' }) },
                        paramMap: of(convertToParamMap({ transactionId: 't1' }))
                    }
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

    describe('split transactions (TXN-4)', () => {
        const parts: Transaction[] = [
            { ...transaction, splitId: 's1', amount: -6 },
            { ...transaction, id: 't2', splitId: 's1', amount: -3 },
            { ...transaction, id: 't3', splitId: 's1', amount: -1 }
        ];
        const renderPart = (options: { confirm?: boolean } = {}) =>
            render(vi.fn().mockResolvedValue(parts[0]), { ...options, splitParts: parts });

        function menuItems(): string[] {
            return Array.from(document.querySelectorAll('.mat-mdc-menu-item .mat-mdc-menu-item-text')).map(i =>
                i.textContent!.trim()
            );
        }

        async function openMenu(fixture: Awaited<ReturnType<typeof render>>['fixture']) {
            (fixture.nativeElement as HTMLElement)
                .querySelector<HTMLButtonElement>('button[aria-label="More options"]')!
                .click();
            await fixture.whenStable();
        }

        it("TXN-4.1 should offer Split for a transaction that isn't split, and reload once it's split", async () => {
            const { fixture, financeService, modalService } = await render();
            modalService.open = vi.fn().mockResolvedValue([transaction, { ...transaction, id: 't2' }]);

            await openMenu(fixture);
            expect(menuItems()).toEqual(['Edit', 'Split', 'Delete']);
            document.querySelectorAll<HTMLButtonElement>('.mat-mdc-menu-item')[1].click();
            await fixture.whenStable();

            expect(modalService.open).toHaveBeenCalledWith(SplitTransactionModalComponent, { transaction, parts: [] });
            expect(financeService.fetchTransaction).toHaveBeenCalledTimes(2);
            expect(financeService.fetchTransactionSplit).not.toHaveBeenCalled();
        });

        it("TXN-4.5 should load a part's split, and offer Edit split and Unsplit", async () => {
            const { fixture, financeService, element } = await renderPart();

            expect(financeService.fetchTransactionSplit).toHaveBeenCalledWith('t1');
            expect(element.textContent).toContain('Split into 3 parts');
            await openMenu(fixture);
            expect(menuItems()).toEqual(['Edit', 'Edit split', 'Unsplit', 'Delete']);
        });

        it('TXN-4.5 should open the first part when the split is edited without this one', async () => {
            const { fixture, modalService, navigate } = await renderPart();
            modalService.open = vi.fn().mockResolvedValue([parts[1], parts[2]]);

            await chooseFromMenu(fixture, 'Edit split');

            expect(modalService.open).toHaveBeenCalledWith(SplitTransactionModalComponent, {
                transaction: parts[0],
                parts
            });
            expect(navigate).toHaveBeenCalledWith(['/transactions', 't2']);
        });

        it('TXN-4.5 APP-2.8 should unsplit after confirming, say so and reload', async () => {
            const { fixture, financeService, modalService, notificationService } = await renderPart();

            await chooseFromMenu(fixture, 'Unsplit');

            expect(modalService.confirm).toHaveBeenCalledWith(
                expect.objectContaining({ title: 'Unsplit Transaction', confirmLabel: 'Unsplit' })
            );
            expect(financeService.unsplitTransaction).toHaveBeenCalledWith('t1');
            expect(notificationService.success).toHaveBeenCalledWith('Transaction unsplit');
            expect(financeService.fetchTransaction).toHaveBeenCalledTimes(2);
        });

        it('TXN-4.5 should leave the split alone when Unsplit is cancelled', async () => {
            const { fixture, financeService } = await renderPart({ confirm: false });

            await chooseFromMenu(fixture, 'Unsplit');

            expect(financeService.unsplitTransaction).not.toHaveBeenCalled();
        });

        it('TXN-4.7 should say that deleting a part deletes the others', async () => {
            const { fixture, modalService } = await renderPart({ confirm: false });

            await chooseFromMenu(fixture, 'Delete');

            expect(modalService.confirm).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: "Delete this transaction and its 2 other parts? This can't be undone."
                })
            );
        });
    });
});
