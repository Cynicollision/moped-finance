import { Entity } from './../../core/types';
import { CategoryNecessity } from './../enum/category-necessity';

export type Category = Entity & {
    groupId: string;
    icon: string;
    name: string;
    isActive: boolean;
    /** Only an Expense category can have one, and it's optional (CAT-3.1). */
    necessity: CategoryNecessity | null;
};