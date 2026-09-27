import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';

/** Instants (timestamps) and "today". Calendar dates (`date` columns, YYYY-MM-DD) use `CalendarDateUtil`. */
export class DateTimeUtil {

    public static now(): Date {
        return new Date();
    }

    /** Today's date in the server's time zone, set by `TZ` (APP-5.6). */
    public static today(): CalendarDate {
        return CalendarDateUtil.fromDate(this.now());
    }

    public static getCurrentTimestamp(): string {
        return this.now().toISOString();
    }

    /** The instant `milliseconds` after `date` (before it, if negative). For durations, not calendar days. */
    public static addMilliseconds(date: Date, milliseconds: number): Date {
        return new Date(date.getTime() + milliseconds);
    }

    public static nowToISOSafeFilename(): string {
        return this.getCurrentTimestamp().substring(0, 19).replace('T', '_').replace(/:/g, '-');
    }
}
