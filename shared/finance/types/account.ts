import { BalanceHistory } from './balance-history';
import { Transaction } from './transaction';
import { AccountCategory } from './../enum/account-category';
import { AccountType } from './../enum/account-type';
import { AccountSubType } from './../enum/account-subtype';

export type Account = {
    id: string;
    profileId: string;
    institutionId: string;
    name: string;
    category: AccountCategory;
    type: AccountType;
    subtype?: AccountSubType;
    balance: number;
    isHidden: boolean;
    isRetirement: boolean;

    balanceHistory?: BalanceHistory[];
    transactions?: Transaction[];
};