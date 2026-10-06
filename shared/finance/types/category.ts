import { Entity } from './../../core/types';
import { CategoryNecessity } from './../enum/category-necessity';

export type Category = Entity & {
    groupId: string;
    /** One emoji, or '' for none (CAT-1.2). */
    icon: string;
    name: string;
    isActive: boolean;
    /** Only an Expense category can have one, and it's optional (CAT-3.1). */
    necessity: CategoryNecessity | null;
};

/** What still uses a category, which its delete has to deal with (CAT-4.4, CAT-4.5). */
export interface CategoryUsage {
    transactionCount: number;
    budgetStreamCount: number;
}
