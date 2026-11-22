import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';
import { AccountBalanceEntry } from '@shared/finance/types';
import { SimplefinAccount, SimplefinTransaction } from './simplefin-response';

/** A bank transaction as Moped records it (SYNC-4.2), before rules. */
export interface SyncedTransaction {
    /** The bank's ID, unique within its bank account (SYNC-4.1). */
    simplefinId: string;
    date: CalendarDate;
    /** Money in is positive (APP-6.3). */
    amount: number;
    merchant: string;
    /** The bank's description, as given. */
    originalStatement: string;
}

/** The days a bank account's transactions are taken from, both included. */
export interface SyncWindow {
    /** The account's Sync transactions from date (SYNC-2.4); null takes everything up to `to`. */
    from: CalendarDate | null;
    /** The latest date a transaction can have (APP-8.1); later ones wait for a later sync. */
    to: CalendarDate;
}

/** Merchant is a `varchar(255)`. */
const maxMerchantLength = 255;

/** For a transaction the bank gives neither a payee nor a description for, since a merchant is required (TXN-1.1). */
export const unknownMerchant = 'Unknown';

/**
 * Pure functions from SimpleFIN's payload to Moped's records: no database, no clock. Dates are worked out in the
 * server's time zone (APP-5.6), which `CalendarDateUtil.fromDate` uses.
 */
export class SyncTransform {
    /** The day a Unix timestamp falls on in the server's time zone. */
    public static toCalendarDate(unixSeconds: number): CalendarDate {
        return CalendarDateUtil.fromDate(new Date(unixSeconds * 1000));
    }

    /**
     * The bank account's posted transactions dated within the window, oldest first (SYNC-4.2). Pending ones, and any
     * not posted yet, are left out (SYNC-4.7).
     */
    public static transactions(account: SimplefinAccount, window: SyncWindow): SyncedTransaction[] {
        return account.transactions
            .filter(isPosted)
            .map(toSyncedTransaction)
            .filter(t => (window.from === null || t.date >= window.from) && t.date <= window.to)
            .sort((a, b) => a.date.localeCompare(b.date) || a.simplefinId.localeCompare(b.simplefinId));
    }

    /** The date of the bank account's earliest posted transaction, for SYNC-2.4's default; null when it has none. */
    public static earliestDate(account: SimplefinAccount): CalendarDate | null {
        const dates = account.transactions.filter(isPosted).map(t => toSyncedTransaction(t).date);
        return dates.length > 0 ? dates.reduce((a, b) => (a < b ? a : b)) : null;
    }

    /**
     * Balance history for an account that has none, worked backward from the bank's balance through the transactions
     * just added (SYNC-4.6): an entry at the end of each day with transactions, one on the bank's balance date when it's
     * later, and one on the day before the earliest. The bank's balance is taken to include every one of the
     * transactions. Oldest first, all set entries (ACCT-5.1).
     */
    public static backfill(
        balance: number,
        balanceDate: CalendarDate,
        transactions: Pick<SyncedTransaction, 'date' | 'amount'>[]
    ): AccountBalanceEntry[] {
        // In cents, so sums of many amounts don't drift.
        const balanceCents = Math.round(balance * 100);
        const centsByDate = new Map<CalendarDate, number>();
        for (const { date, amount } of transactions) {
            centsByDate.set(date, (centsByDate.get(date) ?? 0) + Math.round(amount * 100));
        }

        const dates = [...centsByDate.keys()].sort();
        if (dates.length === 0 || balanceDate > dates[dates.length - 1]) {
            dates.push(balanceDate);
        }

        // Walking back from the latest day, each day's end balance is the next day's less the next day's transactions.
        const entries: AccountBalanceEntry[] = [];
        let cents = balanceCents;
        for (let i = dates.length - 1; i >= 0; i--) {
            entries.push({ date: dates[i], balance: cents / 100 });
            cents -= centsByDate.get(dates[i]) ?? 0;
        }
        if (transactions.length > 0) {
            entries.push({ date: CalendarDateUtil.addDays(dates[0], -1), balance: cents / 100 });
        }
        return entries.reverse();
    }
}

function isPosted(transaction: SimplefinTransaction): boolean {
    return !transaction.pending && transaction.posted > 0;
}

function toSyncedTransaction(transaction: SimplefinTransaction): SyncedTransaction {
    const merchant = (transaction.payee ?? transaction.description).trim() || unknownMerchant;
    return {
        simplefinId: transaction.id,
        // The day the bank says it happened, or failing that the day it posted.
        date: SyncTransform.toCalendarDate(transaction.transactedAt || transaction.posted),
        amount: Math.round(transaction.amount * 100) / 100,
        merchant: merchant.slice(0, maxMerchantLength).trim(),
        originalStatement: transaction.description
    };
}
