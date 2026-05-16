import { Entity } from './../../common/types/entity-base';
import { LocationType } from './../enum';

export type Location = Entity & {
    userId: string;
    name: string;
    type: LocationType;
}
