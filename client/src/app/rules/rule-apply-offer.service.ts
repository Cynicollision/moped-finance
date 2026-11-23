import { Injectable, inject } from '@angular/core';
import { Rule } from '@shared/finance/types';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { FinanceService } from './../common/finance.service';
import { ApplyRuleDialogComponent, ApplyRuleDialogData } from './apply-rule-dialog.component';
import { matchesLines } from './rule-wording';

/** Offers to apply a rule to the existing transactions it matches (CAT-8.5). */
@Injectable({
    providedIn: 'root'
})
export class RuleApplyOffer {
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);

    /**
     * Asks whether to apply the rule when it would change any existing transactions. When it wouldn't, says so if
     * `sayWhenNone` (Apply to existing chosen from the menu), and otherwise says nothing (after saving a rule).
     *
     * @returns true if the rule was applied
     */
    async offer(rule: Rule, sayWhenNone: boolean): Promise<boolean> {
        const matches = await this.financeService.getRuleMatches(rule.id);
        if (!matches) {
            return false;
        }
        if (matchesLines(matches).length === 0) {
            if (sayWhenNone) {
                this.notificationService.success(`${rule.name} has no existing transactions to change`);
            }
            return false;
        }
        const applied = await this.modalService.open<ApplyRuleDialogComponent, ApplyRuleDialogData, boolean>(
            ApplyRuleDialogComponent,
            { rule, matches },
            { size: 'small' }
        );
        return applied === true;
    }
}
