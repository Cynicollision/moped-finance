import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Rule } from '@shared/finance/types';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { FinanceService } from './../common/finance.service';
import { ApplyRuleDialogComponent } from './apply-rule-dialog.component';

describe('ApplyRuleDialogComponent', () => {
    const rule = { id: 'r1', name: 'Blue Bottle' } as Rule;

    async function render(applied = { categorizeCount: 12, renameCount: 30 } as unknown) {
        const financeService = { applyRule: vi.fn().mockResolvedValue(applied) };
        const dialogRef = { close: vi.fn() };
        const notificationService = { success: vi.fn() };
        TestBed.configureTestingModule({
            imports: [ApplyRuleDialogComponent],
            providers: [
                { provide: MAT_DIALOG_DATA, useValue: { rule, matches: { categorizeCount: 12, renameCount: 30 } } },
                { provide: MatDialogRef, useValue: dialogRef },
                { provide: FinanceService, useValue: financeService },
                { provide: NotificationService, useValue: notificationService },
                { provide: ModalService, useValue: { requestClose: vi.fn() } }
            ]
        });

        const fixture = TestBed.createComponent(ApplyRuleDialogComponent);
        await fixture.whenStable();
        const element = fixture.nativeElement as HTMLElement;
        const apply = async () => {
            Array.from(element.querySelectorAll('button'))
                .find(b => b.textContent!.trim() === 'Apply')!
                .click();
            await fixture.whenStable();
        };
        return { element, apply, financeService, dialogRef, notificationService };
    }

    it('CAT-8.5 should say how many transactions each action would change, then apply the rule', async () => {
        const { element, apply, financeService, dialogRef, notificationService } = await render();

        const lines = Array.from(element.querySelectorAll('.changes li')).map(l => l.textContent!.trim());
        expect(lines).toEqual(['Categorize 12 uncategorized transactions', 'Rename the merchant of 30 transactions']);

        await apply();

        expect(financeService.applyRule).toHaveBeenCalledWith('r1');
        expect(notificationService.success).toHaveBeenCalledWith('Rule applied: 12 categorized, 30 renamed');
        expect(dialogRef.close).toHaveBeenCalledWith(true);
    });

    it('CAT-8.5 should stay open when applying fails', async () => {
        const { apply, dialogRef, notificationService } = await render(null);

        await apply();

        expect(notificationService.success).not.toHaveBeenCalled();
        expect(dialogRef.close).not.toHaveBeenCalled();
    });
});
