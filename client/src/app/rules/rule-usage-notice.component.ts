import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { Rule } from '@shared/finance/types';
import { ModalCancelDirective } from './../core/modal/modal-cancel.directive';
import { ModalLayoutComponent } from './../core/modal/modal-layout.component';

export interface RuleUsageNoticeData {
    /** The dialog's title: "Delete Category", "Delete Account". */
    title: string;
    /** What can't be deleted, as the app names it ("🏠 Rent"). */
    name: string;
    rules: Rule[];
}

/**
 * Says that a category or account can't be deleted while rules use it, naming them, in place of the delete's
 * confirmation (CAT-8.8). Closes with 'rules' when the user chooses Rules, leaving the caller to open the Rules screen
 * (and close itself first, if it's a dialog).
 */
@Component({
    selector: 'app-rule-usage-notice',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatDialogModule, MatButtonModule, ModalCancelDirective, ModalLayoutComponent],
    templateUrl: './rule-usage-notice.component.html',
    styleUrl: './rule-usage-notice.component.scss'
})
export class RuleUsageNoticeComponent {
    private dialogRef = inject<MatDialogRef<RuleUsageNoticeComponent, 'rules'>>(MatDialogRef);
    readonly data = inject<RuleUsageNoticeData>(MAT_DIALOG_DATA);
    readonly usedBy =
        this.data.rules.length === 1
            ? `${this.data.name} is used by a rule:`
            : `${this.data.name} is used by ${this.data.rules.length} rules:`;
    readonly instruction = this.data.rules.length === 1 ? 'Edit or delete it first.' : 'Edit or delete them first.';

    openRules() {
        this.dialogRef.close('rules');
    }
}
