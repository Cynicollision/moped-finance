import { Entity } from './../../core/types/entity-base';
import { Account } from './account';
import { Category } from './category';
import { Institution } from './institution';

export type FinanceProfile = Entity & {
    userId: string;

    institutions?: Institution[];
    accounts?: Account[];
    categories?: Category[];
};