import { Entity } from './../../core/types/entity-base';

export type Plant = Entity & {
    userId: string;
    varietyId: string;
    locationId: string;
    plantedDate: Date;
}