import { Entity } from './../../core/types';
import { CategoryClass } from './../enum/category-class';

export type CategoryGroup = Entity & {
    userId: string;
    class: CategoryClass;
    name: string;
};
