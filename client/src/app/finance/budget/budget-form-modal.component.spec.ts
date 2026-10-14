import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { CalendarPeriod } from '@shared/core/enum';
import { SpendingAverage } from '@shared/finance/contracts';
import { BudgetStreamType, CategoryType } from '@shared/finance/enum';
import { BudgetStream, Category, CategoryGroup } from '@shared/finance/types';
import { ModalService } from './../../core/modal/modal.service';
import { NotificationService } from './../../core/notification.service';
import { FinanceService } from './../finance.service';
import { BudgetFormModalData, FinanceBudgetFormModalComponent } from './budget-form-modal.component';

describe('FinanceBudgetFormModalComponent', () => {
    const groups = [
        { id: 'income', name: 'Income', type: CategoryType.Income },
        { id: 'housing', name: 'Housing', type: CategoryType.Expense },
        { id: 'transfers', name: 'Transfers', type: CategoryType.Transfer }
    ] as CategoryGroup[];
    const categories = [
        { id: 'pay', groupId: 'income', name: 'Paycheck', icon: '💼', isActive: true },
        { id: 'rent', groupId: 'housing', name: 'Rent', icon: '🏠', isActive: true },
        { id: 'storage', groupId: 'housing', name: 'Storage Unit', icon: '📦', isActive: false },
        { id: 'savings', groupId: 'transfers', name: 'Savings Transfer', icon: '🔁', isActive: true },
        { id: 'invest', groupId: 'transfers', name: 'Investment Contribution', icon: '📈', isActive: true }
    ] as Category[];

    async function render(data: Partial<BudgetFormModalData> & { type: BudgetStreamType }) {
        const financeService = {
            createBudgetStream: vi.fn().mockResolvedValue({ id: 'BS1' }),
            saveBudgetStream: vi.fn().mockResolvedValue({ id: 'BS1' }),
            deleteBudgetStream: vi.fn().mockResolvedValue(true)
        };
        const dialogRef = { close: vi.fn() };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [FinanceBudgetFormModalComponent],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: { categories, groups, streams: [], ...data } },
                { provide: MatDialogRef, useValue: dialogRef },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: notificationService },
                { provide: ModalService, useValue: { confirm: vi.fn().mockResolvedValue(true), requestClose: vi.fn() } }
            ]
        });

        const fixture = TestBed.createComponent(FinanceBudgetFormModalComponent);
        await fixture.whenStable();
        return {
            fixture,
            element: fixture.nativeElement as HTMLElement,
            financeService,
            dialogRef,
            notificationService
        };
    }

    it('BUD-1.3 should offer only Transfer categories for Savings, and save without a type', async () => {
        const { fixture, element, financeService, notificationService, dialogRef } = await render({
            type: BudgetStreamType.Savings
        });
        const form = fixture.componentInstance;

        expect(element.querySelector('.header-content')!.textContent!.trim()).toBe('Add Savings');
        expect(form.categories().map(c => c.name)).toEqual(['Savings Transfer', 'Investment Contribution']);

        form.budgetForm.setValue({
            name: 'Emergency fund',
            categoryId: 'savings',
            amount: 500,
            recurrence: CalendarPeriod.Monthly
        });
        await form.save();

        expect(financeService.createBudgetStream).toHaveBeenCalledWith({
            name: 'Emergency fund',
            categoryId: 'savings',
            amount: 500,
            recurrence: CalendarPeriod.Monthly
        });
        expect(notificationService.success).toHaveBeenCalledWith('Savings added');
        expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('BUD-1.4 CAT-4.1 should edit a stream, offering the active categories of its type', async () => {
        const stream = {
            id: 'BS1',
            type: BudgetStreamType.Expense,
            name: 'Rent',
            categoryId: 'rent',
            recurrence: CalendarPeriod.Monthly,
            amount: 1500
        } as BudgetStream;
        const { fixture, element, financeService, notificationService } = await render({ stream, type: stream.type });
        const form = fixture.componentInstance;

        expect(element.querySelector('.header-content')!.textContent!.trim()).toBe('Edit Expense');
        expect(form.categories().map(c => c.name)).toEqual(['Rent']);

        form.budgetForm.patchValue({ amount: 1600 });
        await form.save();

        expect(financeService.saveBudgetStream).toHaveBeenCalledWith(
            expect.objectContaining({ id: 'BS1', amount: 1600, categoryId: 'rent' })
        );
        expect(notificationService.success).toHaveBeenCalledWith('Expense saved');
    });

    it('CAT-4.2 should keep offering an inactive category the stream already has', async () => {
        const stream = {
            id: 'BS2',
            type: BudgetStreamType.Expense,
            name: 'Storage',
            categoryId: 'storage',
            recurrence: CalendarPeriod.Monthly,
            amount: 90
        } as BudgetStream;
        const { fixture } = await render({ stream, type: stream.type });

        expect(fixture.componentInstance.categories().map(c => c.name)).toEqual(['Rent', 'Storage Unit']);
    });

    describe('category average', () => {
        const average = (months: number): SpendingAverage => ({
            startDate: '2025-05-01',
            endDate: '2026-04-30',
            months,
            totals: [
                { categoryId: 'pay', type: CategoryType.Income, amount: 4100.5 },
                { categoryId: 'rent', type: CategoryType.Expense, amount: 1480.4 },
                { categoryId: '', type: CategoryType.Expense, amount: 75 }
            ],
            transfers: [{ categoryId: 'savings', amount: 612.5 }]
        });
        const rentStream = (id: string, amount: number, recurrence = CalendarPeriod.Monthly) =>
            ({ id, type: BudgetStreamType.Expense, name: id, categoryId: 'rent', recurrence, amount }) as BudgetStream;

        async function insightFor(data: Partial<BudgetFormModalData> & { type: BudgetStreamType }, categoryId: string) {
            const { fixture, element } = await render(data);
            fixture.componentInstance.budgetForm.controls.categoryId.setValue(categoryId);
            await fixture.whenStable();
            return Array.from(element.querySelectorAll('.category-insight p')).map(p =>
                p.textContent!.replace(/\s+/g, ' ').trim()
            );
        }

        it('BUD-1.8 should say what an expense category has averaged a month, in whole dollars', async () => {
            expect(await insightFor({ type: BudgetStreamType.Expense, average: average(12) }, 'rent')).toEqual([
                "You've averaged $1,480 a month in Rent over the past 12 months."
            ]);
        });

        it('BUD-1.8 should average an income category from its income', async () => {
            expect(await insightFor({ type: BudgetStreamType.Income, average: average(12) }, 'pay')).toEqual([
                "You've averaged $4,101 a month in Paycheck over the past 12 months."
            ]);
        });

        it('BUD-1.8 should average a transfer category by its money out, over the months there are', async () => {
            expect(await insightFor({ type: BudgetStreamType.Savings, average: average(3) }, 'savings')).toEqual([
                "You've averaged $613 a month in Savings Transfer over the past 3 months."
            ]);
            TestBed.resetTestingModule();
            expect(await insightFor({ type: BudgetStreamType.Savings, average: average(1) }, 'invest')).toEqual([
                "You've averaged $0 a month in Investment Contribution over the past month."
            ]);
        });

        it('BUD-1.8 should say nothing about an average with no history, or before a category is chosen', async () => {
            expect(await insightFor({ type: BudgetStreamType.Expense, average: average(0) }, 'rent')).toEqual([]);
            TestBed.resetTestingModule();
            expect(await insightFor({ type: BudgetStreamType.Expense, average: average(12) }, 'Re')).toEqual([]);
        });

        it("BUD-1.8 should add the category's other streams, leaving out the one being edited", async () => {
            const editing = rentStream('BS1', 1500);
            const streams = [editing, rentStream('BS2', 300, CalendarPeriod.Quarterly)];

            expect(await insightFor({ stream: editing, type: editing.type, streams }, 'rent')).toEqual([
                'Your other stream in Rent comes to $100 a month.'
            ]);
            TestBed.resetTestingModule();
            expect(await insightFor({ type: BudgetStreamType.Expense, streams, average: average(12) }, 'rent')).toEqual(
                [
                    "You've averaged $1,480 a month in Rent over the past 12 months.",
                    'Your other streams in Rent come to $1,600 a month.'
                ]
            );
        });
    });
});
