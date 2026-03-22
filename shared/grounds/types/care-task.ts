import { Entity } from './../../core/types/entity-base';
import { CareTaskStatus, CareTaskType } from './../enum';

export type CareTask = Entity & {
    userId: string;
    name: string;
    type: CareTaskType;

    year?: string;
    targetMonth?: string; // TODO: core enum
    targetWeek?: number;

    status?: CareTaskStatus;
    completedDate?: Date;
    notes?: string;
    isAnnualTask?: boolean;

    // TODO: product used?
};

