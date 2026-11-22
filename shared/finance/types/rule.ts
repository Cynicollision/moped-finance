import { Entity } from './../../core/types';
import { RuleActionType } from './../enum/rule-action-type';
import { RuleConditionField } from './../enum/rule-condition-field';
import { RuleOperator } from './../enum/rule-operator';
import { TransactionDirection } from './../enum/transaction-direction';

/** Original Statement or Merchant *contains* or *is exactly* a term, ignoring case (CAT-8.2). */
export interface RuleTextCondition {
    field: RuleConditionField.OriginalStatement | RuleConditionField.Merchant;
    operator: RuleOperator.Contains | RuleOperator.Equals;
    text: string;
}

/** Money out or money in, and its size greater than, less than or equal to a positive amount (CAT-8.2). */
export interface RuleAmountCondition {
    field: RuleConditionField.Amount;
    operator: RuleOperator.GreaterThan | RuleOperator.LessThan | RuleOperator.Equals;
    direction: TransactionDirection;
    amount: number;
}

/** The transaction is in the account. */
export interface RuleAccountCondition {
    field: RuleConditionField.Account;
    accountId: string;
}

export type RuleCondition = RuleTextCondition | RuleAmountCondition | RuleAccountCondition;

export interface RuleSetCategoryAction {
    type: RuleActionType.SetCategory;
    categoryId: string;
}

export interface RuleRenameMerchantAction {
    type: RuleActionType.RenameMerchant;
    merchant: string;
}

export type RuleAction = RuleSetCategoryAction | RuleRenameMerchantAction;

/** Conditions that must all match, and actions for the transactions that do (CAT-8.1, CAT-8.2), in list order (CAT-8.3). */
export type Rule = Entity & {
    name: string;
    /** Where it is in the list, from 0: rules apply in this order. */
    position: number;
    conditions: RuleCondition[];
    actions: RuleAction[];
};

/** A new rule, or the whole of an edited one's conditions and actions. A new rule goes at the end of the list. */
export interface RuleRequest {
    name: string;
    conditions: RuleCondition[];
    actions: RuleAction[];
}

/** What applying a rule to the existing transactions would change (CAT-8.5), or did. */
export interface RuleMatches {
    /** Uncategorized, unsplit transactions it matches, which Set category would categorize. */
    categorizeCount: number;
    /** Unsplit transactions it matches whose merchant Rename merchant would change. */
    renameCount: number;
}
