import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';

/** Instants (timestamps) and "today". Calendar dates (`date` columns, YYYY-MM-DD) use `CalendarDateUtil`. */
export class DateTimeUtil {

    private static readonly systemClock = (): Date => new Date();
    private static clock: () => Date = DateTimeUtil.systemClock;

    public static now(): Date {
        return this.clock();
    }

    /**
     * For tests: make `now()`, and everything built on it, return `clock()`'s value instead of the real time. Pass a
     * `Date` to stop the clock at that instant. Call `resetClock()` afterwards.
     */
    public static setClock(clock: Date | (() => Date)): void {
        this.clock = clock instanceof Date ? () => new Date(clock.getTime()) : clock;
    }

    public static resetClock(): void {
        this.clock = this.systemClock;
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
