import { AccountType } from './../enum/account-type';

export type Account = {
    id: string;
    institutionId: string;
    name: string;
    type: AccountType;
    subtype: string;
    hidden: boolean;
};