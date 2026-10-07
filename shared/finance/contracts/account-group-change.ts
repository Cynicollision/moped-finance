import { CalendarDate } from './../../core/types';
import { AccountGroup } from './../enum';

/**
 * An account group's daily total (DASH-1.4) on its first day in a timeframe and on the timeframe's last day, for its
 * change over the timeframe (DASH-2.2). Signed as stored: liability groups are negative.
 */
export interface AccountGroupChange {
    group: AccountGroup;
    /** The timeframe's first day, or the first day one of the group's accounts has an entry if that's later. */
    startDate: CalendarDate;
    startAmount: number;
    endAmount: number;
}
