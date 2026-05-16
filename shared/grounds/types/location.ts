import { Entity } from './../../common/types';
import { LocationType } from './../enum';

export type Location = Entity & {
    userId: string;
    name: string;
    type: LocationType;
}
