import { Entity } from './../../common/types';
import { AccountCategory, AccountGroup, AccountType } from './../enum';
import { BalanceHistory } from './balance-history';
import { Transaction } from './transaction';

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