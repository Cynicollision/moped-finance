import { Entity } from './../../common/types/entity-base';

export type Institution = Entity & {
    userId: string;
    name: string;
};