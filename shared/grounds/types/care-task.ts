import { Entity } from './../../common/types/entity-base';
import { CareTaskCategory, CareTaskStatus, CareTaskType } from './../enum';

export type CareTask = Entity & {
    userId: string;
    name: string;
    category: CareTaskCategory;
    type: CareTaskType;
    year: string;
    status: CareTaskStatus;
    targetMonth?: string; // TODO: core enum
    targetWeek?: number;
    completedDate?: Date;
    notes?: string;
    isAnnualTask?: boolean;
    productId?: string;
};

