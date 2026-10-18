import { CalendarDate } from './../../core/types';
import { SpendingTotal } from './spending-total';

/** How many months an average month can be taken over (CASH-1.12); 12 unless another is asked for. */
export const spendingAverageMonths = [3, 6, 12] as const;
export type SpendingAverageMonths = (typeof spendingAverageMonths)[number];

/**
 * The average month over the full months before the current one: the last 3, 6 or 12, and none before the month of
 * the oldest transaction Spending counts (BUD-1.8, CASH-1.12). Amounts are to the cent.
 */
export interface SpendingAverage {
    /** The first day of the window's first month; with no months, the day after `endDate`. */
    startDate: CalendarDate;
    /** The last day of the month before the current one. */
    endDate: CalendarDate;
    /** How many months the window has: as many as were asked for, fewer with a shorter history, or 0 with none. */
    months: number;
    /** Spending's totals for the window (CASH-1.3) divided by its months. */
    totals: SpendingTotal[];
}
