/**
 * A category's net amount for a period (CASH-1.2). Uncategorized transactions have an empty `categoryId` and come
 * as up to two totals, money in and money out, so each can count by its sign (CASH-1.3).
 */
export type SpendingTotal = {
    categoryId: string;
    amount: number;
};
