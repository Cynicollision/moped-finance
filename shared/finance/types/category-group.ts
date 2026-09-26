import { Entity } from './../../core/types';
import { CategoryClass } from './../enum/category-class';

export type CategoryGroup = Entity & {
    class: CategoryClass;
    name: string;
};
