import { Entity } from './entity-base';

export type User = Entity & {
    displayName: string;
    username: string;
};