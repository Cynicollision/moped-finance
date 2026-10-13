import { CalendarDate, Entity } from './../../core/types';
import { AccountCategory, AccountGroup, AccountType } from './../enum';

/** What's stored for an account, and what creating or editing one sends. */
export interface AccountFields {
    institutionId: string;
    name: string;
    type: AccountType;
    isHidden?: boolean;
    /** Set by the server: accounts are manual until they're linked to a bank (ACCT-4.3). Ignored in requests. */
    isManual?: boolean;
}

/** A balance to record for a manual account, as a set entry replacing any on that date (ACCT-2.2). Signed as stored. */
export interface AccountBalanceEntry {
    date: CalendarDate;
    balance: number;
}

/** Creating or editing an account: its fields, and optionally a balance to record with them in one save. */
export type AccountRequest = AccountFields & {
    balanceEntry?: AccountBalanceEntry;
};

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
