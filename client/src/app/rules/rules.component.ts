import { ChangeDetectionStrategy, Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CdkDrag, CdkDragDrop, CdkDragHandle, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { Rule } from '@shared/finance/types';
import { ListColumn, ListModule } from './../core/list/list.component';
import { PageHeaderComponent } from './../core/layout/page-header.component';
import { CardSkeletonComponent } from './../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { viewResource } from './../core/loading/view-resource';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { FinanceService } from './../common/finance.service';
import { RuleApplyOffer } from './rule-apply-offer.service';
import { RuleNames, actionText, conditionText, isSkippedAction } from './rule-wording';

/** A rule as its row reads. */
interface RuleRow {
    rule: Rule;
    conditions: string[];
    actions: { text: string; skipped: boolean }[];
}

/**
 * The Rules screen (CAT-8.3): the rules in the order they apply, each with its conditions and actions, reordered by
 * dragging or with Move up and Move down, and saved in the new order straight away.
 */
@Component({
    selector: 'app-rules',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        RouterLink,
        CdkDropList,
        CdkDrag,
        CdkDragHandle,
        MatButtonModule,
        MatDividerModule,
        MatIconModule,
        MatMenuModule,
        ListModule,
        PageHeaderComponent,
        CardSkeletonComponent,
        LoadErrorComponent
    ],
    templateUrl: './rules.component.html',
    styleUrl: './rules.component.scss'
})
export class RulesComponent {
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);
    private applyOffer = inject(RuleApplyOffer);

    readonly data = viewResource({
        loader: async () => {
            const [rules, accounts, categories] = await Promise.all([
                this.financeService.fetchRules(),
                this.financeService.fetchAllAccounts(),
                this.financeService.fetchCategories(false)
            ]);
            const names: RuleNames = {
                accounts: new Map(accounts.map(a => [a.id, a])),
                categories: new Map(categories.map(c => [c.id, c]))
            };
            return { rules, names };
        }
    });

    /** The rules in their order, which a drag or move changes at once, before the server confirms it. */
    readonly rules = linkedSignal(() => this.data.value()?.rules ?? []);
    readonly rows = computed<RuleRow[]>(() => {
        const names = this.data.value()?.names;
        if (!names) {
            return [];
        }
        return this.rules().map(rule => ({
            rule,
            conditions: rule.conditions.map(c => conditionText(c, names)),
            actions: rule.actions.map(a => ({ text: actionText(a, names), skipped: isSkippedAction(a, names) }))
        }));
    });
    /** While a new order or a delete is being saved, the list can't be changed. */
    readonly busy = signal(false);

    readonly columns: ListColumn[] = [
        // The drag handle; on phones it sits at the end, beside the menu.
        { key: 'handle', label: '', width: '2rem', compact: 'trailing' },
        { key: 'name', label: 'Rule', width: 'minmax(0, 1fr)', compact: 'primary' },
        { key: 'conditions', label: 'When', width: 'minmax(0, 2fr)', compact: 'secondary' },
        { key: 'actions', label: 'Then', width: 'minmax(0, 2fr)', compact: 'secondary' },
        { key: 'menu', label: '', width: '2.5rem', align: 'end', compact: 'trailing' }
    ];

    drop(event: CdkDragDrop<Rule[]>) {
        this.move(event.previousIndex, event.currentIndex);
    }

    /** Moves a rule to a new place in the list and saves the order (CAT-8.3), putting it back if the server refuses. */
    async move(from: number, to: number) {
        const before = this.rules();
        if (from === to || to < 0 || to >= before.length || this.busy()) {
            return;
        }
        const after = [...before];
        moveItemInArray(after, from, to);
        this.rules.set(after);

        this.busy.set(true);
        const saved = await this.financeService.reorderRules(after.map(rule => rule.id));
        this.busy.set(false);
        this.rules.set(saved ?? before);
    }

    async applyToExisting(rule: Rule) {
        await this.applyOffer.offer(rule, true);
    }

    async delete(rule: Rule) {
        const confirmed = await this.modalService.confirm({
            title: 'Delete Rule',
            message: `Delete ${rule.name}? Transactions it already changed keep their category and merchant.`,
            confirmLabel: 'Delete',
            isWarn: true
        });
        if (!confirmed) {
            return;
        }

        this.busy.set(true);
        const deleted = await this.financeService.deleteRule(rule.id);
        this.busy.set(false);
        if (deleted) {
            this.notificationService.success('Rule deleted');
            this.data.reload();
        }
    }
}
