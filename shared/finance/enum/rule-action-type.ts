/** What a rule does to a transaction it matches (CAT-8.1). Each can appear once in a rule. */
export enum RuleActionType {
    SetCategory = 'set_category',
    RenameMerchant = 'rename_merchant'
}
