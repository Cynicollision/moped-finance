import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormArray, FormControl, FormGroup, ReactiveFormsModule, ValidatorFn, Validators } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { RuleActionType, RuleConditionField, RuleOperator, TransactionDirection } from '@shared/finance/enum';
import { Account, Category, Rule, RuleAction, RuleCondition, RuleRequest } from '@shared/finance/types';
import { Crumb, PageHeaderComponent } from './../core/layout/page-header.component';
import { CardSkeletonComponent } from './../core/loading/card-skeleton.component';
import { LoadErrorComponent } from './../core/loading/load-error.component';
import { viewResource } from './../core/loading/view-resource';
import { ModalService } from './../core/modal/modal.service';
import { NotificationService } from './../core/notification.service';
import { HasUnsavedChanges } from './../core/unsaved-changes';
import { categoryChoices, chosenCategoryValidator } from './../common/category-choice';
import { categoryLabel } from './../common/category-label';
import { FinanceService } from './../common/finance.service';
import { RuleApplyOffer } from './rule-apply-offer.service';
import { actionTypeLabels, amountOperatorLabels, conditionFieldLabels, textOperatorLabels } from './rule-wording';

/**
 * A condition's controls. Every condition has all of them, and those its field doesn't use are disabled, so they
 * neither validate nor count.
 */
type ConditionForm = FormGroup<{
    field: FormControl<RuleConditionField>;
    operator: FormControl<RuleOperator>;
    text: FormControl<string>;
    direction: FormControl<TransactionDirection>;
    amount: FormControl<number | null>;
    accountId: FormControl<string>;
}>;

/** An action's controls, those its type doesn't use disabled. */
type ActionForm = FormGroup<{
    type: FormControl<RuleActionType>;
    categoryId: FormControl<string>;
    merchant: FormControl<string>;
}>;

const conditionFields = Object.keys(conditionFieldLabels) as RuleConditionField[];
const actionTypes = Object.keys(actionTypeLabels) as RuleActionType[];
const textFields = [RuleConditionField.Merchant, RuleConditionField.OriginalStatement];

/** What a rule's name can be (CAT-8.1). */
const nameMaxLength = 100;

/**
 * Adds or edits a rule (CAT-8.1): its name, then any of the condition fields and actions, each once. A full page,
 * since a rule has several of each. Saving offers to apply the rule to existing transactions (CAT-8.5). A new rule
 * can be filled in from a transaction, through the query's `merchant` or `statement` (CAT-8.9).
 */
@Component({
    selector: 'app-rule-form',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        ReactiveFormsModule,
        MatAutocompleteModule,
        MatButtonModule,
        MatButtonToggleModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatMenuModule,
        MatProgressSpinnerModule,
        MatSelectModule,
        PageHeaderComponent,
        CardSkeletonComponent,
        LoadErrorComponent
    ],
    templateUrl: './rule-form.component.html',
    styleUrl: './rule-form.component.scss'
})
export class RuleFormComponent implements HasUnsavedChanges {
    private financeService = inject(FinanceService);
    private modalService = inject(ModalService);
    private notificationService = inject(NotificationService);
    private applyOffer = inject(RuleApplyOffer);
    private router = inject(Router);
    private route = inject(ActivatedRoute);

    readonly ruleId = this.route.snapshot.paramMap.get('ruleId');
    readonly isEditing = this.ruleId !== null;
    readonly crumbs: Crumb[] = [
        { label: 'Settings', link: '/settings' },
        { label: 'Rules', link: '/settings/rules' }
    ];

    readonly Field = RuleConditionField;
    readonly ActionType = RuleActionType;
    readonly Direction = TransactionDirection;
    readonly fieldLabels = conditionFieldLabels;
    readonly actionLabels = actionTypeLabels;
    readonly textOperators = Object.entries(textOperatorLabels) as [RuleOperator, string][];
    readonly amountOperators = Object.entries(amountOperatorLabels) as [RuleOperator, string][];
    readonly nameMaxLength = nameMaxLength;

    readonly form = new FormGroup({
        name: new FormControl('', {
            nonNullable: true,
            validators: [Validators.required, Validators.maxLength(nameMaxLength)]
        }),
        conditions: new FormArray<ConditionForm>([]),
        actions: new FormArray<ActionForm>([])
    });
    readonly saving = signal(false);
    readonly deleting = signal(false);
    /** Set once saved or deleted, so leaving doesn't ask about the form. */
    private done = false;

    readonly data = viewResource({
        loader: async () => {
            const [rule, accounts, categories] = await Promise.all([
                this.ruleId ? this.financeService.fetchRule(this.ruleId) : Promise.resolve(undefined),
                this.financeService.fetchAllAccounts(),
                this.financeService.fetchCategories(false)
            ]);
            return { rule, accounts, categories };
        }
    });
    readonly rule = computed(() => this.data.value()?.rule);
    readonly title = computed(() => (this.isEditing ? 'Edit Rule' : 'New Rule'));
    private readonly categories = computed(() => this.data.value()?.categories ?? []);
    private readonly categoryMap = computed(() => new Map(this.categories().map(c => [c.id, c])));
    private readonly accountMap = computed(() => new Map((this.data.value()?.accounts ?? []).map(a => [a.id, a])));

    /** The accounts an Account condition offers, by name: open, unhidden ones, plus the one the rule has (TXN-2.1). */
    readonly accountOptions = computed(() => {
        const current = this.rule()?.conditions.find(c => c.field === RuleConditionField.Account);
        const keep = current?.field === RuleConditionField.Account ? current.accountId : undefined;
        return (this.data.value()?.accounts ?? [])
            .filter(a => (!a.isHidden && !a.closedOn) || a.id === keep)
            .sort((a, b) => a.name.localeCompare(b.name));
    });

    /** Bumped whenever a condition or action is added or removed, so the menus of what's left follow. */
    private readonly shape = signal(0);
    readonly unusedFields = computed(() => {
        this.shape();
        const used = this.form.controls.conditions.controls.map(c => c.controls.field.value);
        return conditionFields.filter(field => !used.includes(field));
    });
    readonly unusedActions = computed(() => {
        this.shape();
        const used = this.form.controls.actions.controls.map(a => a.controls.type.value);
        return actionTypes.filter(type => !used.includes(type));
    });

    constructor() {
        // The form is filled in once what it needs has loaded.
        let filled = false;
        effect(() => {
            const value = this.data.value();
            if (value && !filled) {
                filled = true;
                this.fill(value.rule);
            }
        });
        // A category can only be checked once they've loaded.
        effect(() => {
            this.categoryMap();
            for (const action of this.form.controls.actions.controls) {
                action.controls.categoryId.updateValueAndValidity({ emitEvent: false });
            }
        });
    }

    hasUnsavedChanges(): boolean {
        return !this.done && this.form.dirty;
    }

    private fill(rule: Rule | undefined) {
        if (rule) {
            this.form.controls.name.setValue(rule.name);
            rule.conditions.forEach(c => this.form.controls.conditions.push(this.conditionForm(c)));
            rule.actions.forEach(a => this.form.controls.actions.push(this.actionForm(a)));
        } else {
            // A new rule starts with the usual case: a merchant to match and a category to set. Filled in from a
            // transaction, it matches the merchant exactly, or the original statement when it has no merchant.
            const query = this.route.snapshot.queryParamMap;
            const merchant = query.get('merchant')?.trim() ?? '';
            const statement = query.get('statement')?.trim() ?? '';
            const condition: RuleCondition =
                merchant || !statement
                    ? {
                          field: RuleConditionField.Merchant,
                          operator: merchant ? RuleOperator.Equals : RuleOperator.Contains,
                          text: merchant
                      }
                    : { field: RuleConditionField.OriginalStatement, operator: RuleOperator.Contains, text: statement };
            this.form.controls.name.setValue((merchant || statement).slice(0, nameMaxLength));
            this.form.controls.conditions.push(this.conditionForm(condition));
            this.form.controls.actions.push(this.actionForm({ type: RuleActionType.SetCategory, categoryId: '' }));
        }
        this.shape.update(n => n + 1);
    }

    private conditionForm(condition: RuleCondition): ConditionForm {
        const group: ConditionForm = new FormGroup({
            field: new FormControl(condition.field, { nonNullable: true }),
            operator: new FormControl(
                condition.field === RuleConditionField.Account ? RuleOperator.Equals : condition.operator,
                { nonNullable: true }
            ),
            text: new FormControl('text' in condition ? condition.text : '', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(255), notBlank]
            }),
            direction: new FormControl('direction' in condition ? condition.direction : TransactionDirection.Out, {
                nonNullable: true
            }),
            amount: new FormControl<number | null>('amount' in condition ? condition.amount : null, {
                validators: [Validators.required, Validators.min(0.01)]
            }),
            accountId: new FormControl('accountId' in condition ? condition.accountId : '', {
                nonNullable: true,
                validators: [Validators.required]
            })
        });
        const uses: Record<RuleConditionField, string[]> = {
            [RuleConditionField.Merchant]: ['operator', 'text'],
            [RuleConditionField.OriginalStatement]: ['operator', 'text'],
            [RuleConditionField.Amount]: ['operator', 'direction', 'amount'],
            [RuleConditionField.Account]: ['accountId']
        };
        for (const name of ['operator', 'text', 'direction', 'amount', 'accountId'] as const) {
            if (!uses[condition.field].includes(name)) {
                group.controls[name].disable();
            }
        }
        return group;
    }

    private actionForm(action: RuleAction): ActionForm {
        const group: ActionForm = new FormGroup({
            type: new FormControl(action.type, { nonNullable: true }),
            categoryId: new FormControl('categoryId' in action ? action.categoryId : '', {
                nonNullable: true,
                validators: [Validators.required, chosenCategoryValidator(() => this.categoryMap())]
            }),
            merchant: new FormControl('merchant' in action ? action.merchant : '', {
                nonNullable: true,
                validators: [Validators.required, Validators.maxLength(255), notBlank]
            })
        });
        if (action.type === RuleActionType.SetCategory) {
            group.controls.merchant.disable();
        } else {
            group.controls.categoryId.disable();
        }
        return group;
    }

    addCondition(field: RuleConditionField) {
        const condition: RuleCondition = textFields.includes(field)
            ? {
                  field: field as RuleConditionField.Merchant,
                  operator: RuleOperator.Contains,
                  text: ''
              }
            : field === RuleConditionField.Amount
              ? { field, operator: RuleOperator.GreaterThan, direction: TransactionDirection.Out, amount: 0 }
              : { field: RuleConditionField.Account, accountId: '' };
        const group = this.conditionForm(condition);
        if (field === RuleConditionField.Amount) {
            group.controls.amount.setValue(null);
        }
        this.form.controls.conditions.push(group);
        this.changedShape();
    }

    removeCondition(index: number) {
        this.form.controls.conditions.removeAt(index);
        this.changedShape();
    }

    addAction(type: RuleActionType) {
        const action: RuleAction =
            type === RuleActionType.SetCategory ? { type, categoryId: '' } : { type, merchant: '' };
        this.form.controls.actions.push(this.actionForm(action));
        this.changedShape();
    }

    removeAction(index: number) {
        this.form.controls.actions.removeAt(index);
        this.changedShape();
    }

    private changedShape() {
        this.form.markAsDirty();
        this.shape.update(n => n + 1);
    }

    /**
     * The categories a Set category offers, matching what's typed: active ones, plus the one the rule already has, so
     * a rule whose category was made inactive still shows it (CAT-8.1).
     */
    categoryOptions(value: string): Category[] {
        const currentId = this.currentCategoryId();
        return categoryChoices(this.categories(), value, c => c.isActive || c.id === currentId);
    }

    /** Whether the category chosen is inactive, so the rules skip it (CAT-8.1). */
    isInactiveCategory(id: string): boolean {
        return this.categoryMap().get(id)?.isActive === false;
    }

    readonly displayCategory = (id: string | null | undefined): string => {
        const category = id ? this.categoryMap().get(id) : undefined;
        return category ? categoryLabel(category) : (id ?? '');
    };

    private currentCategoryId(): string | undefined {
        const action = this.rule()?.actions.find(a => a.type === RuleActionType.SetCategory);
        return action?.type === RuleActionType.SetCategory ? action.categoryId : undefined;
    }

    accountName(id: string): string {
        return this.accountMap().get(id)?.name ?? '';
    }

    isClosedOrHidden(account: Account): boolean {
        return !!account.closedOn || !!account.isHidden;
    }

    async save() {
        if (this.form.invalid || this.saving()) {
            this.form.markAllAsTouched();
            return;
        }

        const request = this.request();
        const current = this.rule();
        this.saving.set(true);
        // An edit sends its actions only when they changed, so a rule whose category was made inactive can still be
        // renamed or have its conditions changed (CAT-8.1).
        const saved = current
            ? await this.financeService.saveRule(current.id, {
                  name: request.name,
                  conditions: request.conditions,
                  ...(this.form.controls.actions.dirty ? { actions: request.actions } : {})
              })
            : await this.financeService.createRule(request);
        this.saving.set(false);
        if (!saved) {
            return;
        }

        this.done = true;
        this.notificationService.success(current ? 'Rule saved' : 'Rule created');
        await this.applyOffer.offer(saved, false);
        this.router.navigate(['/settings/rules']);
    }

    private request(): RuleRequest {
        const value = this.form.getRawValue();
        const conditions = value.conditions.map((c): RuleCondition => {
            switch (c.field) {
                case RuleConditionField.Amount:
                    return {
                        field: c.field,
                        operator: c.operator as RuleOperator.GreaterThan,
                        direction: c.direction,
                        amount: c.amount ?? 0
                    };
                case RuleConditionField.Account:
                    return { field: c.field, accountId: c.accountId };
                default:
                    return { field: c.field, operator: c.operator as RuleOperator.Contains, text: c.text.trim() };
            }
        });
        const actions = value.actions.map((a): RuleAction =>
            a.type === RuleActionType.SetCategory
                ? { type: a.type, categoryId: a.categoryId }
                : { type: a.type, merchant: a.merchant.trim() }
        );
        return { name: value.name.trim(), conditions, actions };
    }

    cancel() {
        this.router.navigate(['/settings/rules']);
    }

    async delete() {
        const rule = this.rule();
        if (!rule || this.deleting()) {
            return;
        }
        const confirmed = await this.modalService.confirm({
            title: 'Delete Rule',
            message: `Delete ${rule.name}? Transactions it already changed keep their category and merchant.`,
            confirmLabel: 'Delete',
            isWarn: true
        });
        if (!confirmed) {
            return;
        }

        this.deleting.set(true);
        const deleted = await this.financeService.deleteRule(rule.id);
        this.deleting.set(false);
        if (deleted) {
            this.done = true;
            this.notificationService.success('Rule deleted');
            this.router.navigate(['/settings/rules']);
        }
    }
}

/** Refuses text that's only spaces, which the server trims to nothing. */
const notBlank: ValidatorFn = control =>
    typeof control.value === 'string' && control.value.length > 0 && control.value.trim() === ''
        ? { blank: true }
        : null;
