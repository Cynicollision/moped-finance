import { Entity } from './../../common/types/entity-base';

export type Plant = Entity & {
    userId: string;
    varietyId: string;
    locationId: string;
    plantedDate: Date;
}