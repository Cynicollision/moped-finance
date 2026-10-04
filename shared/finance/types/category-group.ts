import { Entity } from './../../core/types';
import { CategoryType } from './../enum/category-type';

export type CategoryGroup = Entity & {
    type: CategoryType;
    name: string;
};
