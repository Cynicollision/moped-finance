import {
    CategorySource,
    RuleActionType,
    RuleConditionField,
    RuleOperator,
    TransactionDirection
} from '@shared/finance/enum';
import { Rule, RuleCondition, Transaction } from '@shared/finance/types';

/** The fields of a transaction that rules look at. */
export type RuleSubject = Pick<Transaction, 'accountId' | 'amount' | 'merchant' | 'originalStatement' | 'categoryId'>;

/** A transaction that applying one rule to the existing transactions may change (CAT-8.5). */
export type ExistingTransaction = RuleSubject & Pick<Transaction, 'id' | 'splitId'>;

/** The existing transactions one rule would change (CAT-8.5), by ID. */
export interface RuleApplyPlan {
    /** Uncategorized ones it would categorize. */
    categorize: string[];
    /** Those whose merchant it would rename. */
    rename: string[];
}

export interface RuleEngineOptions {
    /** Rename merchant applies to imported and synced transactions, not to a merchant typed in the form (CAT-8.4). */
    renameMerchant: boolean;
}

/**
 * Categorizes and cleans up transactions with the user's rules (CAT-8). Pure: the caller loads the rules, and the
 * categories that are inactive, whose Set category is skipped (CAT-8.1).
 */
export class RuleEngine {
    /** For when there are no rules to apply. */
    public static readonly none = new RuleEngine([]);

    private readonly rules: Rule[];

    constructor(
        rules: readonly Rule[],
        private readonly inactiveCategoryIds: ReadonlySet<string> = new Set()
    ) {
        this.rules = [...rules].sort((a, b) => a.position - b.position);
    }

    /**
     * The transaction as the rules leave it (CAT-8.3, CAT-8.4). They apply in order, each to the transaction as the
     * rules above it left it, and the first to set a field wins. Set category applies only to an Uncategorized
     * transaction, so a category the user chose or the import file gave is never replaced, and nothing changes a split
     * transaction (CAT-8.7).
     */
    public apply<T extends RuleSubject & Pick<Transaction, 'splitId'>>(
        transaction: T,
        options: RuleEngineOptions
    ): T & Pick<Transaction, 'categorySource' | 'categoryRuleId' | 'merchantRuleId'> {
        const result = {
            categorySource: transaction.categoryId ? CategorySource.User : null,
            categoryRuleId: '',
            merchantRuleId: '',
            ...transaction
        };
        if (transaction.splitId) {
            return result;
        }

        let categoryDecided = !!transaction.categoryId;
        let merchantDecided = !options.renameMerchant;
        for (const rule of this.rules) {
            if (categoryDecided && merchantDecided) {
                break;
            }
            if (!RuleEngine.matches(rule, result)) {
                continue;
            }
            for (const action of rule.actions) {
                if (
                    action.type === RuleActionType.SetCategory &&
                    !categoryDecided &&
                    !this.inactiveCategoryIds.has(action.categoryId)
                ) {
                    result.categoryId = action.categoryId;
                    result.categorySource = CategorySource.Rule;
                    result.categoryRuleId = rule.id!;
                    categoryDecided = true;
                } else if (action.type === RuleActionType.RenameMerchant && !merchantDecided) {
                    result.merchant = action.merchant;
                    result.merchantRuleId = rule.id!;
                    merchantDecided = true;
                }
            }
        }
        return result;
    }

    /**
     * What applying one rule to the existing transactions would change (CAT-8.5): Set category the Uncategorized ones
     * it matches, Rename merchant every match whose merchant isn't already the new one, and neither a split one
     * (CAT-8.7). Each is matched as it is now.
     */
    public static plan(
        rule: Rule,
        transactions: ExistingTransaction[],
        inactiveCategoryIds: ReadonlySet<string> = new Set()
    ): RuleApplyPlan {
        const setCategory = rule.actions.find(a => a.type === RuleActionType.SetCategory);
        const rename = rule.actions.find(a => a.type === RuleActionType.RenameMerchant);
        const categorizes = !!setCategory && !inactiveCategoryIds.has(setCategory.categoryId);

        const plan: RuleApplyPlan = { categorize: [], rename: [] };
        for (const transaction of transactions) {
            if (transaction.splitId || !RuleEngine.matches(rule, transaction)) {
                continue;
            }
            if (categorizes && !transaction.categoryId) {
                plan.categorize.push(transaction.id!);
            }
            if (rename && transaction.merchant !== rename.merchant) {
                plan.rename.push(transaction.id!);
            }
        }
        return plan;
    }

    /** Whether every one of the rule's conditions matches (CAT-8.2). */
    public static matches(rule: Rule, transaction: RuleSubject): boolean {
        return rule.conditions.every(condition => RuleEngine.conditionMatches(condition, transaction));
    }

    private static conditionMatches(condition: RuleCondition, transaction: RuleSubject): boolean {
        switch (condition.field) {
            case RuleConditionField.OriginalStatement:
            case RuleConditionField.Merchant: {
                // Ignoring case and the spaces around either.
                const value = normalize(
                    condition.field === RuleConditionField.Merchant
                        ? transaction.merchant
                        : transaction.originalStatement
                );
                const term = normalize(condition.text);
                return condition.operator === RuleOperator.Equals ? value === term : value.includes(term);
            }
            case RuleConditionField.Amount: {
                // Only transactions in its direction, then their size (CAT-8.2), compared in cents.
                const inDirection =
                    condition.direction === TransactionDirection.Out ? transaction.amount < 0 : transaction.amount > 0;
                if (!inDirection) {
                    return false;
                }
                const size = Math.round(Math.abs(transaction.amount) * 100);
                const limit = Math.round(condition.amount * 100);
                switch (condition.operator) {
                    case RuleOperator.GreaterThan:
                        return size > limit;
                    case RuleOperator.LessThan:
                        return size < limit;
                    default:
                        return size === limit;
                }
            }
            case RuleConditionField.Account:
                return transaction.accountId === condition.accountId;
        }
    }
}

function normalize(text: string): string {
    return text.trim().toLowerCase();
}
