import { Entity } from './../../common/types';

export type Plant = Entity & {
    userId: string;
    varietyId: string;
    locationId: string;
    plantedDate: Date;
}