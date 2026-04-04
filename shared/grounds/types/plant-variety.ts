import { Entity } from './../../core/types/entity-base';

export type PlantVariety = Entity & {
    userId: string;
    category: string;
    commonName: string;
    varietyName?: string;
    brandName?: string;
    description?: string;
    fertilizerNotes?: string;
    pruningNotes?: string;
    soilNotes?: string;
    sunlightNotes?: string;
    wateringNotes?: string;
}