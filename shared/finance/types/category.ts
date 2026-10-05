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
