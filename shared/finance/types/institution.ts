import { Entity } from './../../core/types/entity-base';

export type Institution = Entity & {
    userId: string;
    name: string;
};