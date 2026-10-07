import { CalendarDate, Entity } from './../../core/types';
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
        /** The current balance (ACCT-2.1): the latest entry on or before the as-of date, or 0 if none. */
        balance?: number;
        /** The date of that entry ("Balance as of", ACCT-2.6), or null if there's none. */
        balanceDate?: CalendarDate | null;
    };
