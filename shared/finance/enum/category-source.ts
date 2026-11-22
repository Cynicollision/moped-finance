/** Who gave a transaction its category (CAT-8.6, CAT-9.2). An Uncategorized transaction has none. */
export enum CategorySource {
    User = 'user',
    Rule = 'rule',
    Learning = 'learning'
}
