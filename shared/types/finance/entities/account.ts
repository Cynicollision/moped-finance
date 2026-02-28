import { BalanceHistory } from './balance-history';
import { Transaction } from './transaction';

export enum AccountCategory {
    Asset = 'Asset',
    Liability = 'Liability'
}

export enum AccountType {
    Cash = 'Cash',
    CreditCard = 'Credit Card',
    Investment = 'Investment',
    RealEstate = 'Real Estate',
    Mortgage = 'Home Mortgage'
}

export enum AccountSubType {
    Brokerage = 'Brokerage',
    Checking = 'Checking',
    HSA = 'HSA',
    PrimaryResidence = 'Primary Residence',
    Retirement_401k = '401k',
    Retirement_IRA = 'IRA',
    Savings = 'Savings'
}

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