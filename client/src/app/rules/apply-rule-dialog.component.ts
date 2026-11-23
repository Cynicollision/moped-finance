import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Rule, RuleMatches } from '@shared/finance/types';
import { ModalCancelDirective } from './../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../core/modal/modal-layout.component';
import { NotificationService } from './../core/notification.service';
import { FinanceService } from './../common/finance.service';
import { appliedMessage, matchesLines } from './rule-wording';

export interface ApplyRuleDialogData {
    rule: Rule;
    /** What applying it would change; at least one count is more than none. */
    matches: RuleMatches;
}

/**
 * Offers to apply a rule to the existing transactions it matches, saying what each action would change (CAT-8.5).
 * Applies it itself and closes with true once it has; Not now closes without.
 */
@Component({
    selector: 'app-apply-rule-dialog',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatDialogModule, MatButtonModule, MatProgressSpinnerModule, ModalCancelDirective, ModalLayoutComponent],
    templateUrl: './apply-rule-dialog.component.html',
    styleUrl: './apply-rule-dialog.component.scss'
})
export class ApplyRuleDialogComponent {
    private financeService = inject(FinanceService);
    private notificationService = inject(NotificationService);
    private dialogRef = inject<MatDialogRef<ApplyRuleDialogComponent, boolean>>(MatDialogRef);
    readonly data = inject<ApplyRuleDialogData>(MAT_DIALOG_DATA);

    readonly lines = matchesLines(this.data.matches);
    readonly applying = signal(false);

    async apply() {
        if (this.applying()) {
            return;
        }
        this.applying.set(true);
        const applied = await this.financeService.applyRule(this.data.rule.id);
        this.applying.set(false);
        if (applied) {
            this.notificationService.success(appliedMessage(applied));
            this.dialogRef.close(true);
        }
    }
}
