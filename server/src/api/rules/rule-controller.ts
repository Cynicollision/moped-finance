import { RuleActionType } from '@shared/finance/enum';
import { Rule, RuleAction, RuleMatches } from '@shared/finance/types';
import { EntityFactory } from '@server/data';
import { IAppLogger } from '@server/logging';
import { OperationContext, OperationResult, Result } from '@server/routing';
import { ICategoryData } from './../categories/category-data';
import { RuleApplyPlan, RuleEngine } from './rule-engine';
import { IRuleData } from './rule-data';
import { CreateRuleRequest, RuleOrderRequest, UpdateRuleRequest } from './rule-schema';

export class RuleController {
    constructor(
        private logger: IAppLogger,
        private ruleData: IRuleData,
        private categoryData: ICategoryData
    ) {}

    public async getRules(_context: OperationContext): Promise<OperationResult<Rule[]>> {
        return Result.success(await this.ruleData.retrieveAll());
    }

    public async getRule(_context: OperationContext, ruleId: string): Promise<OperationResult<Rule>> {
        const rule = await this.ruleData.retrieveSingle(ruleId);
        return rule ? Result.success(rule) : Result.userErrorNotFound();
    }

    public async createRule(_context: OperationContext, input: CreateRuleRequest): Promise<OperationResult<Rule>> {
        // A missing category or account fails the insert's foreign key, which OperationHandler reports as a 400.
        const refusal = await this.checkActions(input.actions);
        if (refusal) {
            return Result.userError(refusal);
        }
        const created = await this.ruleData.insert(EntityFactory.createRule(input));
        return Result.successCreated(created);
    }

    public async saveRule(
        _context: OperationContext,
        ruleId: string,
        changes: UpdateRuleRequest
    ): Promise<OperationResult<Rule>> {
        const current = await this.ruleData.retrieveSingle(ruleId);
        if (!current) {
            return Result.userErrorNotFound();
        }
        // Only actions sent are checked, so a rule whose category was made inactive can still be renamed.
        const refusal = changes.actions ? await this.checkActions(changes.actions) : null;
        if (refusal) {
            return Result.userError(refusal);
        }
        const updated = await this.ruleData.update({ ...current, ...changes });
        return updated ? Result.successUpdated(updated) : Result.userErrorNotFound();
    }

    public async deleteRule(_context: OperationContext, ruleId: string): Promise<OperationResult<void>> {
        const deleted = await this.ruleData.delete(ruleId);
        return deleted ? Result.successDeleted() : Result.userErrorNotFound();
    }

    /** Puts the rules in a new order (CAT-8.3), given every rule's ID once. */
    public async reorderRules(_context: OperationContext, input: RuleOrderRequest): Promise<OperationResult<Rule[]>> {
        const current = await this.ruleData.retrieveAll();
        const currentIds = new Set(current.map(rule => rule.id));
        const sentIds = new Set(input.ids);
        if (
            sentIds.size !== input.ids.length ||
            sentIds.size !== currentIds.size ||
            input.ids.some(id => !currentIds.has(id))
        ) {
            return Result.userError("Send every rule's ID once, in the new order.");
        }
        await this.ruleData.reorder(input.ids);
        return Result.successUpdated(await this.ruleData.retrieveAll());
    }

    /** What applying the rule to the existing transactions would change (CAT-8.5). */
    public async getRuleMatches(_context: OperationContext, ruleId: string): Promise<OperationResult<RuleMatches>> {
        const rule = await this.ruleData.retrieveSingle(ruleId);
        if (!rule) {
            return Result.userErrorNotFound();
        }
        return Result.success(counts(await this.plan(rule)));
    }

    /** Applies the rule to the existing transactions it matches (CAT-8.5), saying what it changed. */
    public async applyRule(_context: OperationContext, ruleId: string): Promise<OperationResult<RuleMatches>> {
        const rule = await this.ruleData.retrieveSingle(ruleId);
        if (!rule) {
            return Result.userErrorNotFound();
        }
        const plan = await this.plan(rule);
        await this.ruleData.apply(rule, plan);
        return Result.successUpdated(counts(plan));
    }

    private async plan(rule: Rule): Promise<RuleApplyPlan> {
        const [transactions, inactiveCategoryIds] = await Promise.all([
            this.ruleData.retrieveExistingTransactions(),
            this.ruleData.retrieveInactiveCategoryIds()
        ]);
        return RuleEngine.plan(rule, transactions, inactiveCategoryIds);
    }

    /** Why the actions can't be saved, if they can't: Set category takes an active category (CAT-8.1). */
    private async checkActions(actions: RuleAction[]): Promise<string | null> {
        const setCategory = actions.find(a => a.type === RuleActionType.SetCategory);
        if (setCategory) {
            const category = await this.categoryData.retrieveSingle(setCategory.categoryId);
            // A missing one is left to the foreign key.
            if (category && !category.isActive) {
                return 'Choose an active category.';
            }
        }
        return null;
    }
}

function counts(plan: RuleApplyPlan): RuleMatches {
    return { categorizeCount: plan.categorize.length, renameCount: plan.rename.length };
}
