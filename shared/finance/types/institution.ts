import { Entity } from './../../core/types';

export type Institution = Entity & {
    userId: string;
    name: string;
};