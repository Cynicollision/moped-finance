import { Injectable } from '@angular/core';
import { CalendarDate } from '@shared/core/types';
import { CalendarDateUtil } from '@shared/core/util';
import { Environment } from './../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class DateProviderService {
    /** The current instant; for a calendar date, use `today()`. */
    now(): Date {
        // eslint-disable-next-line no-restricted-syntax -- the one place that reads the real clock
        return Environment.isDebugMode ? new Date('2026-05-17T00:00:00') : new Date();
    }

    /** Today's date where the browser is (APP-4.1's fixed date in debug mode). */
    today(): CalendarDate {
        return CalendarDateUtil.fromDate(this.now());
    }
}
