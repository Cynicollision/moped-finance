import { Entity } from './../../core/types';

export type Category = Entity & {
    groupId: string;
    icon: string;
    name: string;
    isActive: boolean;
};