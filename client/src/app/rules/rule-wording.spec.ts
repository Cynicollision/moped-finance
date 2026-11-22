import { RuleActionType, RuleConditionField, RuleOperator, TransactionDirection } from '@shared/finance/enum';
import { Account, Category, Rule } from '@shared/finance/types';
import {
    RuleNames,
    actionText,
    appliedMessage,
    conditionText,
    isSkippedAction,
    matchesLines,
    rulesUsing
} from './rule-wording';

describe('rule wording', () => {
    const names: RuleNames = {
        accounts: new Map([['acc-1', { id: 'acc-1', name: 'Everyday Checking' } as Account]]),
        categories: new Map([
            ['coffee', { id: 'coffee', name: 'Coffee', icon: '☕', isActive: true } as Category],
            ['old', { id: 'old', name: 'Old', icon: '', isActive: false } as Category]
        ])
    };

    function rule(id: string, changes: Partial<Rule>): Rule {
        return {
            id,
            createdAt: new Date(2026, 0, 1),
            updatedAt: new Date(2026, 0, 1),
            name: id,
            position: 0,
            conditions: [{ field: RuleConditionField.Merchant, operator: RuleOperator.Contains, text: id }],
            actions: [{ type: RuleActionType.RenameMerchant, merchant: id }],
            ...changes
        };
    }

    it('CAT-8.3 should read each kind of condition', () => {
        expect(
            conditionText(
                { field: RuleConditionField.OriginalStatement, operator: RuleOperator.Contains, text: 'SQ *BLUE' },
                names
            )
        ).toBe('Original Statement contains "SQ *BLUE"');
        expect(
            conditionText({ field: RuleConditionField.Merchant, operator: RuleOperator.Equals, text: 'Blue' }, names)
        ).toBe('Merchant is exactly "Blue"');
        expect(
            conditionText(
                {
                    field: RuleConditionField.Amount,
                    operator: RuleOperator.GreaterThan,
                    direction: TransactionDirection.Out,
                    amount: 100
                },
                names
            )
        ).toBe('Money out, greater than $100.00');
        expect(
            conditionText(
                {
                    field: RuleConditionField.Amount,
                    operator: RuleOperator.Equals,
                    direction: TransactionDirection.In,
                    amount: 12.5
                },
                names
            )
        ).toBe('Money in, equal to $12.50');
        expect(conditionText({ field: RuleConditionField.Account, accountId: 'acc-1' }, names)).toBe(
            'Account is Everyday Checking'
        );
    });

    it('CAT-8.1 CAT-8.3 should read each action, and mark a Set category whose category is inactive', () => {
        const coffee = { type: RuleActionType.SetCategory, categoryId: 'coffee' } as const;
        const old = { type: RuleActionType.SetCategory, categoryId: 'old' } as const;
        const rename = { type: RuleActionType.RenameMerchant, merchant: 'Blue Bottle' } as const;

        expect(actionText(coffee, names)).toBe('Set category to ☕ Coffee');
        expect(actionText(rename, names)).toBe('Rename merchant to Blue Bottle');
        expect(isSkippedAction(coffee, names)).toBe(false);
        expect(isSkippedAction(old, names)).toBe(true);
        expect(isSkippedAction(rename, names)).toBe(false);
    });

    it('CAT-8.5 should say what applying a rule would change, leaving out actions that change nothing', () => {
        expect(matchesLines({ categorizeCount: 12, renameCount: 30 })).toEqual([
            'Categorize 12 uncategorized transactions',
            'Rename the merchant of 30 transactions'
        ]);
        expect(matchesLines({ categorizeCount: 1, renameCount: 0 })).toEqual([
            'Categorize 1 uncategorized transaction'
        ]);
        expect(matchesLines({ categorizeCount: 0, renameCount: 0 })).toEqual([]);
        expect(appliedMessage({ categorizeCount: 12, renameCount: 30 })).toBe(
            'Rule applied: 12 categorized, 30 renamed'
        );
    });

    it('CAT-8.8 should find the rules that set a category or have an account condition', () => {
        const rules = [
            rule('sets-coffee', { actions: [{ type: RuleActionType.SetCategory, categoryId: 'coffee' }] }),
            rule('in-checking', { conditions: [{ field: RuleConditionField.Account, accountId: 'acc-1' }] }),
            rule('other', {})
        ];

        expect(rulesUsing(rules, { categoryId: 'coffee' }).map(r => r.id)).toEqual(['sets-coffee']);
        expect(rulesUsing(rules, { accountId: 'acc-1' }).map(r => r.id)).toEqual(['in-checking']);
        expect(rulesUsing(rules, { categoryId: 'old' })).toEqual([]);
    });
});
