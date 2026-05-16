import { Entity } from './../../common/types/entity-base';
import { CareTaskType } from './../enum';

export type Product = Entity & {
    userId: string;
    name: string;
    manufacturer: string;
    careTaskType: CareTaskType;
    purposeDescription: string;
    url: string;
};