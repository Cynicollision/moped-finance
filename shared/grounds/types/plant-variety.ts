import { Entity } from './../../core/types/entity-base';

export type PlantVariety = Entity & {
    userId: string;
    name: string;
    fertilizerNotes: string;
    pruningNotes: string;
    soilNotes: string;
    sunlightNotes: string;
    wateringNotes: string;
}