import { Entity } from './../../common/types';

export type Institution = Entity & {
    userId: string;
    name: string;
};