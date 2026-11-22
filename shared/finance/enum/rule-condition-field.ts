/** What a rule's condition looks at (CAT-8.1). Each can appear once in a rule. */
export enum RuleConditionField {
    OriginalStatement = 'original_statement',
    Merchant = 'merchant',
    Amount = 'amount',
    Account = 'account'
}
