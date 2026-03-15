import { Entity } from './../../core/types/entity-base';
import { CategoryType } from './../enum/category-type';

export type Category = Entity & {
    profileId: string;
    type: CategoryType;
    group: string;
    icon: string;
    name: string;
    isActive: boolean;
};