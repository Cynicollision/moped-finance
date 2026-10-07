import { Entity } from './../../core/types';
import { AccountCategory, AccountGroup, AccountType } from './../enum';

/** What's stored for an account, and what creating or editing one sends. */
export interface AccountFields {
    institutionId: string;
    name: string;
    type: AccountType;
    isHidden?: boolean;
    isManual?: boolean;
    hideFromSpending?: boolean;
}

export type Account = Entity &
    AccountFields & {
        /** Derived from the type (ACCT-1.2); not stored, and ignored in requests. */
        group: AccountGroup;
        /** Derived from the type (ACCT-1.2); not stored, and ignored in requests. */
        category: AccountCategory;
        balance?: number;
    };
