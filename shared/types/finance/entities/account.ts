import { AccountType } from './../enum/account-type';
import { BalanceHistory } from './balance-history';
import { Transaction } from './transaction';

export type Account = {
    id: string;
    institutionId: string;
    name: string;
    type: AccountType;
    subtype: string;
    hidden: boolean;

    balanceHistory?: BalanceHistory[];
    transactions?: Transaction[];
};