import {
    CategorySource,
    RuleActionType,
    RuleConditionField,
    RuleOperator,
    TransactionDirection
} from '@shared/finance/enum';
import { Rule, RuleAction, RuleAmountCondition, RuleCondition } from '@shared/finance/types';
import { RuleEngine } from './rule-engine';

function rule(id: string, position: number, conditions: RuleCondition[], actions: RuleAction[]): Rule {
    const now = new Date('2026-11-22T12:00:00Z');
    return { id, createdAt: now, updatedAt: now, name: id, position, conditions, actions };
}

const merchantIs = (text: string): RuleCondition => ({
    field: RuleConditionField.Merchant,
    operator: RuleOperator.Equals,
    text
});
const statementContains = (text: string): RuleCondition => ({
    field: RuleConditionField.OriginalStatement,
    operator: RuleOperator.Contains,
    text
});
const setCategory = (categoryId: string): RuleAction => ({ type: RuleActionType.SetCategory, categoryId });
const rename = (merchant: string): RuleAction => ({ type: RuleActionType.RenameMerchant, merchant });

const purchase = {
    id: 'TRX-1',
    accountId: 'AC-CHECKING',
    amount: -150,
    merchant: 'SQ *BLUE BOTTLE 1234',
    originalStatement: 'SQ *BLUE BOTTLE 1234 OAKLAND CA',
    categoryId: '',
    splitId: ''
};
const synced = { renameMerchant: true };

describe('RuleEngine', () => {
    describe('matching', () => {
        it('CAT-8.2 should match an amount only in its direction, then by size', () => {
            const over100 = rule(
                'big-spend',
                0,
                [
                    {
                        field: RuleConditionField.Amount,
                        operator: RuleOperator.GreaterThan,
                        direction: TransactionDirection.Out,
                        amount: 100
                    }
                ],
                [setCategory('CT-BIG')]
            );

            expect(RuleEngine.matches(over100, { ...purchase, amount: -150 })).toBe(true);
            expect(RuleEngine.matches(over100, { ...purchase, amount: 150 })).toBe(false);
            expect(RuleEngine.matches(over100, { ...purchase, amount: -100 })).toBe(false);
        });

        it('CAT-8.2 should compare less than and equal to in cents', () => {
            const amount = (operator: RuleAmountCondition['operator'], value: number) =>
                rule(
                    'r',
                    0,
                    [{ field: RuleConditionField.Amount, operator, direction: TransactionDirection.In, amount: value }],
                    [setCategory('CT')]
                );
            const deposit = { ...purchase, amount: 0.3 };

            expect(RuleEngine.matches(amount(RuleOperator.Equals, 0.1 + 0.2), deposit)).toBe(true);
            expect(RuleEngine.matches(amount(RuleOperator.LessThan, 0.31), deposit)).toBe(true);
            expect(RuleEngine.matches(amount(RuleOperator.LessThan, 0.3), deposit)).toBe(false);
        });

        it('CAT-8.2 should match text ignoring case, contains or exactly', () => {
            expect(RuleEngine.matches(rule('r', 0, [statementContains('blue bottle')], []), purchase)).toBe(true);
            expect(RuleEngine.matches(rule('r', 0, [merchantIs('sq *blue bottle 1234 ')], []), purchase)).toBe(true);
            expect(RuleEngine.matches(rule('r', 0, [merchantIs('blue bottle')], []), purchase)).toBe(false);
        });

        it('CAT-8.2 should match only when every condition matches', () => {
            const inSavings = rule(
                'r',
                0,
                [statementContains('blue bottle'), { field: RuleConditionField.Account, accountId: 'AC-SAVINGS' }],
                []
            );

            expect(RuleEngine.matches(inSavings, purchase)).toBe(false);
            expect(RuleEngine.matches(inSavings, { ...purchase, accountId: 'AC-SAVINGS' })).toBe(true);
        });
    });

    describe('apply', () => {
        it('CAT-8.3 should let a rule match the merchant a rule above it renamed', () => {
            const engine = new RuleEngine([
                rule('coffee', 1, [merchantIs('Blue Bottle')], [setCategory('CT-COFFEE')]),
                rule('rename', 0, [statementContains('SQ *BLUE BOTTLE')], [rename('Blue Bottle')])
            ]);

            expect(engine.apply(purchase, synced)).toMatchObject({
                merchant: 'Blue Bottle',
                merchantRuleId: 'rename',
                categoryId: 'CT-COFFEE',
                categorySource: CategorySource.Rule,
                categoryRuleId: 'coffee'
            });
        });

        it('CAT-8.3 should keep what the first rule to set a field set', () => {
            const engine = new RuleEngine([
                rule('first', 0, [statementContains('blue')], [setCategory('CT-COFFEE'), rename('Blue Bottle')]),
                rule('second', 1, [statementContains('bottle')], [setCategory('CT-DINING'), rename('Bottle Shop')])
            ]);

            expect(engine.apply(purchase, synced)).toMatchObject({
                categoryId: 'CT-COFFEE',
                categoryRuleId: 'first',
                merchant: 'Blue Bottle',
                merchantRuleId: 'first'
            });
        });

        it('CAT-8.4 should not rename a merchant typed in the form, but still categorize', () => {
            const engine = new RuleEngine([
                rule('r', 0, [statementContains('blue')], [setCategory('CT-COFFEE'), rename('Blue Bottle')])
            ]);

            expect(engine.apply(purchase, { renameMerchant: false })).toMatchObject({
                merchant: purchase.merchant,
                merchantRuleId: '',
                categoryId: 'CT-COFFEE'
            });
        });

        it("CAT-8.4 should never replace a transaction's category, but still rename its merchant", () => {
            const engine = new RuleEngine([
                rule('r', 0, [statementContains('blue')], [setCategory('CT-COFFEE'), rename('Blue Bottle')])
            ]);

            expect(engine.apply({ ...purchase, categoryId: 'CT-GIFTS' }, synced)).toMatchObject({
                categoryId: 'CT-GIFTS',
                categorySource: CategorySource.User,
                categoryRuleId: '',
                merchant: 'Blue Bottle'
            });
        });

        it('CAT-5.5 should leave a transaction no rule matches Uncategorized', () => {
            const engine = new RuleEngine([rule('r', 0, [statementContains('payroll')], [setCategory('CT-PAY')])]);

            expect(engine.apply(purchase, synced)).toMatchObject({
                categoryId: '',
                categorySource: null,
                categoryRuleId: ''
            });
        });

        it("CAT-8.1 should skip an inactive category's Set category, leaving it to a rule below", () => {
            const engine = new RuleEngine(
                [
                    rule('retired', 0, [statementContains('blue')], [setCategory('CT-OLD'), rename('Blue Bottle')]),
                    rule('current', 1, [merchantIs('Blue Bottle')], [setCategory('CT-COFFEE')])
                ],
                new Set(['CT-OLD'])
            );

            expect(engine.apply(purchase, synced)).toMatchObject({
                merchant: 'Blue Bottle',
                merchantRuleId: 'retired',
                categoryId: 'CT-COFFEE',
                categoryRuleId: 'current'
            });
        });

        it('CAT-8.7 should leave a split transaction alone', () => {
            const engine = new RuleEngine([
                rule('r', 0, [statementContains('blue')], [setCategory('CT-COFFEE'), rename('Blue Bottle')])
            ]);

            expect(engine.apply({ ...purchase, splitId: 'SPL-1' }, synced)).toMatchObject({
                categoryId: '',
                merchant: purchase.merchant
            });
        });
    });

    describe('plan', () => {
        const coffee = rule(
            'coffee',
            0,
            [statementContains('blue bottle')],
            [setCategory('CT-COFFEE'), rename('Blue Bottle')]
        );

        it('CAT-8.5 should categorize only Uncategorized matches and rename every match not already renamed', () => {
            const transactions = [
                { ...purchase, id: 'uncategorized' },
                { ...purchase, id: 'categorized', categoryId: 'CT-GIFTS' },
                { ...purchase, id: 'renamed', merchant: 'Blue Bottle', categoryId: 'CT-COFFEE' },
                { ...purchase, id: 'split', splitId: 'SPL-1' },
                { ...purchase, id: 'other', originalStatement: 'PAYROLL' }
            ];

            expect(RuleEngine.plan(coffee, transactions)).toEqual({
                categorize: ['uncategorized'],
                rename: ['uncategorized', 'categorized']
            });
        });

        it('CAT-8.1 should not categorize with an inactive category', () => {
            expect(RuleEngine.plan(coffee, [purchase], new Set(['CT-COFFEE']))).toEqual({
                categorize: [],
                rename: [purchase.id]
            });
        });
    });
});
