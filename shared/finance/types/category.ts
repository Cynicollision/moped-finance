import { Entity } from './../../core/types';

export type Category = Entity & {
    userId: string;
    groupId: string;
    icon: string;
    name: string;
    isActive: boolean;
};