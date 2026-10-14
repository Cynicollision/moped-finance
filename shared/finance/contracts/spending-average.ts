import { CalendarDate } from './../../core/types';
import { SpendingTotal } from './spending-total';

/** A category's average money moved out of accounts a month: how a Transfer category is averaged (BUD-1.8). */
export interface TransferAverage {
    categoryId: string;
    amount: number;
}

/**
 * The average month over the full months before the current one: at most 12, and none before the month of the
 * oldest transaction Spending counts (BUD-1.8, CASH-1.12). Amounts are to the cent.
 */
export interface SpendingAverage {
    /** The first day of the window's first month; with no months, the day after `endDate`. */
    startDate: CalendarDate;
    /** The last day of the month before the current one. */
    endDate: CalendarDate;
    /** How many months the window has: 12, fewer with a shorter history, or 0 with none. */
    months: number;
    /** Spending's totals for the window (CASH-1.3) divided by its months. */
    totals: SpendingTotal[];
    /** Transfer categories' money out for the window divided by its months. */
    transfers: TransferAverage[];
}
