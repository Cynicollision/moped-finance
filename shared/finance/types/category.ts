import { Entity } from './../../core/types/entity-base';
import { CategoryClass } from '../enum/category-class';

export type Category = Entity & {
    profileId: string;
    class: CategoryClass;
    group: string;
    icon: string;
    name: string;
    isActive: boolean;
};