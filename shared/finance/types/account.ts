import { Entity } from './../../core/types/entity-base';
import { BalanceHistory } from './balance-history';
import { Transaction } from './transaction';
import { AccountCategory } from './../enum/account-category';
import { AccountGroup } from './../enum/account-group';
import { AccountType } from './../enum/account-type';

export type Account = Entity & {
    userId: string;
    institutionId: string;
    name: string;
    category: AccountCategory;
    group: AccountGroup;
    type: AccountType;
    balance: number;
    isHidden: boolean;
    isManual: boolean;
    isRetirement: boolean;
    hideFromCashflow: boolean;

    balanceHistory?: BalanceHistory[];
    transactions?: Transaction[];
};