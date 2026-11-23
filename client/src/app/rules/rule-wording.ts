import { RuleActionType, RuleConditionField, RuleOperator, TransactionDirection } from '@shared/finance/enum';
import { Account, Category, Rule, RuleAction, RuleCondition, RuleMatches } from '@shared/finance/types';
import { categoryLabel } from './../common/category-label';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** The condition fields, in the order the form offers them (CAT-8.1). */
export const conditionFieldLabels: Record<RuleConditionField, string> = {
    [RuleConditionField.Merchant]: 'Merchant',
    [RuleConditionField.OriginalStatement]: 'Original Statement',
    [RuleConditionField.Amount]: 'Amount',
    [RuleConditionField.Account]: 'Account'
};

/** The actions, in the order the form offers them (CAT-8.1). */
export const actionTypeLabels: Record<RuleActionType, string> = {
    [RuleActionType.SetCategory]: 'Set category',
    [RuleActionType.RenameMerchant]: 'Rename merchant'
};

export const textOperatorLabels: Partial<Record<RuleOperator, string>> = {
    [RuleOperator.Contains]: 'contains',
    [RuleOperator.Equals]: 'is exactly'
};

export const amountOperatorLabels: Partial<Record<RuleOperator, string>> = {
    [RuleOperator.GreaterThan]: 'greater than',
    [RuleOperator.LessThan]: 'less than',
    [RuleOperator.Equals]: 'equal to'
};

/** What a rule's text names: its accounts and categories, found by ID. */
export interface RuleNames {
    accounts: ReadonlyMap<string, Account>;
    categories: ReadonlyMap<string, Category>;
}

/** A condition as the Rules screen reads it: 'Merchant contains "SQ *BLUE"', 'Money out, greater than $100.00'. */
export function conditionText(condition: RuleCondition, names: RuleNames): string {
    switch (condition.field) {
        case RuleConditionField.Account:
            return `Account is ${names.accounts.get(condition.accountId)?.name ?? 'a deleted account'}`;
        case RuleConditionField.Amount: {
            const direction = condition.direction === TransactionDirection.Out ? 'Money out' : 'Money in';
            return `${direction}, ${amountOperatorLabels[condition.operator]} ${currency.format(condition.amount)}`;
        }
        default:
            return `${conditionFieldLabels[condition.field]} ${textOperatorLabels[condition.operator]} "${condition.text}"`;
    }
}

/** An action as the Rules screen reads it: 'Set category to 🏠 Rent', 'Rename merchant to Blue Bottle'. */
export function actionText(action: RuleAction, names: RuleNames): string {
    if (action.type === RuleActionType.SetCategory) {
        const category = names.categories.get(action.categoryId);
        return `Set category to ${category ? categoryLabel(category) : 'a deleted category'}`;
    }
    return `Rename merchant to ${action.merchant}`;
}

/** Whether the action is a Set category whose category is inactive, which the rules skip (CAT-8.1). */
export function isSkippedAction(action: RuleAction, names: RuleNames): boolean {
    return action.type === RuleActionType.SetCategory && names.categories.get(action.categoryId)?.isActive === false;
}

/** What applying a rule to existing transactions would do, or did, one line per action that changes any (CAT-8.5). */
export function matchesLines(matches: RuleMatches): string[] {
    const lines: string[] = [];
    if (matches.categorizeCount > 0) {
        lines.push(`Categorize ${count(matches.categorizeCount, 'uncategorized transaction')}`);
    }
    if (matches.renameCount > 0) {
        lines.push(`Rename the merchant of ${count(matches.renameCount, 'transaction')}`);
    }
    return lines;
}

/** A success message for what applying a rule changed: "Rule applied: 12 categorized, 30 renamed". */
export function appliedMessage(applied: RuleMatches): string {
    const parts: string[] = [];
    if (applied.categorizeCount > 0) {
        parts.push(`${applied.categorizeCount} categorized`);
    }
    if (applied.renameCount > 0) {
        parts.push(`${applied.renameCount} renamed`);
    }
    return parts.length ? `Rule applied: ${parts.join(', ')}` : 'Rule applied: no transactions changed';
}

/** The rules that use a category in Set category, or an account in a condition (CAT-8.8). */
export function rulesUsing(rules: Rule[], used: { categoryId?: string; accountId?: string }): Rule[] {
    return rules.filter(
        rule =>
            rule.actions.some(a => a.type === RuleActionType.SetCategory && a.categoryId === used.categoryId) ||
            rule.conditions.some(c => c.field === RuleConditionField.Account && c.accountId === used.accountId)
    );
}

function count(n: number, noun: string): string {
    return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
