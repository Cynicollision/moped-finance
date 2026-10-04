import { Entity } from './../../core/types';
import { AccountCategory, AccountGroup, AccountType } from './../enum';
import { BalanceHistory } from './balance-history';
import { Transaction } from './transaction';

export type Account = Entity & {
    institutionId: string;
    name: string;
    category: AccountCategory;
    group: AccountGroup;
    // Null for groups that have no account types (e.g. Credit Card).
    type: AccountType | null;
    balance?: number;
    isHidden?: boolean;
    isManual?: boolean;
    isRetirement?: boolean;
    hideFromSpending?: boolean;

    balanceHistory?: BalanceHistory[];
    transactions?: Transaction[];
};
