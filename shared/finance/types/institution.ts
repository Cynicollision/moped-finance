import { Entity } from './../../core/types/entity-base';

export type Institution = Entity & {
    profileId: string;
    name: string;
};