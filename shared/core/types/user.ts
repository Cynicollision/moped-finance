import { Entity } from './entity-base';

export type User = Entity & {
    name: string;
    username: string;
};