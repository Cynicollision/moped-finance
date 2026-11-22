/**
 * How a rule's condition compares (CAT-8.1): Original Statement and Merchant use `Contains` and `Equals` (*is exactly*),
 * Amount uses `GreaterThan`, `LessThan` and `Equals`, and Account is always `Equals` (*is*).
 */
export enum RuleOperator {
    Contains = 'contains',
    Equals = 'equals',
    GreaterThan = 'greater_than',
    LessThan = 'less_than'
}
