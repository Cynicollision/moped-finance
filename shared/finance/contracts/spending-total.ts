import { CategoryType } from './../enum';

/**
 * A category's total for a period, in the Spending section it counts in (CASH-1.2, CASH-1.3). Transfer categories
 * aren't included. Uncategorized transactions have an empty `categoryId` and come as up to two totals: money in as
 * income and money out as expenses.
 */
export interface SpendingTotal {
    categoryId: string;
    type: CategoryType.Income | CategoryType.Expense;
    /**
     * As the section shows it: money in for income, money out for expenses. Negative when the category's net runs
     * against its type, such as an expense category whose refunds exceed its spending (CASH-1.9).
     */
    amount: number;
}
