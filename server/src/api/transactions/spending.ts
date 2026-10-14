import { SpendingTotal } from '@shared/finance/contracts';
import { CategoryType } from '@shared/finance/enum';
import { CategoryFlow } from './transaction-data';

/** How Spending counts what came in and went out (CASH-1.3). */
export class Spending {
    /**
     * Income categories count as income and Expense categories as expenses, each by its net, so refunds reduce
     * spending (CASH-1.9). Transfer categories are left out. Uncategorized money in counts as income and money out
     * as expenses.
     */
    public static totals(flows: CategoryFlow[]): SpendingTotal[] {
        return flows.flatMap((flow): SpendingTotal[] => {
            switch (flow.categoryType) {
                case CategoryType.Income:
                    return [{ categoryId: flow.categoryId, type: CategoryType.Income, amount: net(flow) }];
                case CategoryType.Expense:
                    return [{ categoryId: flow.categoryId, type: CategoryType.Expense, amount: -net(flow) }];
                case CategoryType.Transfer:
                    return [];
                default: {
                    const uncategorized: SpendingTotal[] = [];
                    if (flow.moneyIn > 0) {
                        uncategorized.push({ categoryId: '', type: CategoryType.Income, amount: flow.moneyIn });
                    }
                    if (flow.moneyOut > 0) {
                        uncategorized.push({ categoryId: '', type: CategoryType.Expense, amount: flow.moneyOut });
                    }
                    return uncategorized;
                }
            }
        });
    }
}

// Rounded to the cent, since money in and money out are added up apart.
function net(flow: CategoryFlow): number {
    return Math.round((flow.moneyIn - flow.moneyOut) * 100) / 100;
}
