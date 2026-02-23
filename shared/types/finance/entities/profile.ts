import { Account } from './account';
import { Category } from './category';
import { Institution } from './institution';

export type FinanceProfile = {
    id: string;
    userId: string;

    institutions?: Institution[];
    accounts?: Account[];
    categories?: Category[];
};