import { CategoryNecessity } from '@shared/finance/enum';
import { Category } from '@shared/finance/types';

/** Which part of the expenses split a category falls in: its necessity, or Unclassified without one (CAT-2.3). */
export type ExpenseNecessity = CategoryNecessity | 'unclassified';

/** The split's parts, in the order Budget and Spending show them. */
export const expenseNecessities: readonly { key: ExpenseNecessity; label: string }[] = [
    { key: CategoryNecessity.Essential, label: 'Essential' },
    { key: CategoryNecessity.Discretionary, label: 'Discretionary' },
    { key: 'unclassified', label: 'Unclassified' }
];

/** The part of the split an expense category's amounts go in; Unclassified for one without a necessity, or none at all. */
export function expenseNecessityOf(category: Category | undefined): ExpenseNecessity {
    return category?.necessity ?? 'unclassified';
}
