import { CalendarPeriod, HistoryTimeframe } from './../enum';
import { CalendarDate } from './../types';

const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

type DateParts = { year: number; month: number; day: number };

/** Works with `CalendarDate`s (YYYY-MM-DD) as calendar days, so results don't depend on the time zone. */
export class CalendarDateUtil {
    /** True for a real date written YYYY-MM-DD; false for other formats and impossible dates such as 2026-02-30. */
    public static isValid(value: string): boolean {
        const match = calendarDatePattern.exec(value);
        if (!match) {
            return false;
        }

        const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
        return month >= 1 && month <= 12 && day >= 1 && day <= this.daysInMonth(year, month);
    }

    /** The day `date` falls on in the local time zone. */
    public static fromDate(date: Date): CalendarDate {
        return this.format({ year: date.getFullYear(), month: date.getMonth() + 1, day: date.getDate() });
    }

    /** Midnight local time at the start of the day, for date pickers and date formatting. */
    public static toDate(value: CalendarDate): Date {
        const { year, month, day } = this.parse(value);
        return new Date(year, month - 1, day);
    }

    public static addDays(value: CalendarDate, days: number): CalendarDate {
        const { year, month, day } = this.parse(value);
        const date = new Date(Date.UTC(year, month - 1, day + days));
        return this.format({ year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() });
    }

    /** Moves by whole months, keeping the day but clamping it to the end of a shorter month (2026-03-31 less a month is 2026-02-28). */
    public static addMonths(value: CalendarDate, months: number): CalendarDate {
        const { year, month, day } = this.parse(value);
        const monthIndex = year * 12 + (month - 1) + months;
        const newYear = Math.floor(monthIndex / 12);
        const newMonth = monthIndex - newYear * 12 + 1;
        return this.format({ year: newYear, month: newMonth, day: Math.min(day, this.daysInMonth(newYear, newMonth)) });
    }

    public static addYears(value: CalendarDate, years: number): CalendarDate {
        return this.addMonths(value, years * 12);
    }

    /** The first and last days of the month, quarter or year that `asOfDate` is in, both included. */
    public static getPeriod(
        period: CalendarPeriod,
        asOfDate: CalendarDate
    ): { startDate: CalendarDate; endDate: CalendarDate } {
        const { year, month } = this.parse(asOfDate);
        let firstMonth: number;
        let monthCount: number;

        switch (period) {
            case CalendarPeriod.Monthly:
                [firstMonth, monthCount] = [month, 1];
                break;
            case CalendarPeriod.Quarterly:
                [firstMonth, monthCount] = [Math.floor((month - 1) / 3) * 3 + 1, 3];
                break;
            case CalendarPeriod.Yearly:
                [firstMonth, monthCount] = [1, 12];
                break;
        }

        const lastMonth = firstMonth + monthCount - 1;
        return {
            startDate: this.format({ year, month: firstMonth, day: 1 }),
            endDate: this.format({ year, month: lastMonth, day: this.daysInMonth(year, lastMonth) })
        };
    }

    /** The first day of a history timeframe that ends on `asOfDate`. */
    public static getTimeframeStart(timeframe: HistoryTimeframe, asOfDate: CalendarDate): CalendarDate {
        switch (timeframe) {
            case HistoryTimeframe.PastThirtyDays:
                return this.addDays(asOfDate, -30);
            case HistoryTimeframe.PastSixtyDays:
                return this.addDays(asOfDate, -60);
            case HistoryTimeframe.PastNinetyDays:
                return this.addDays(asOfDate, -90);
            case HistoryTimeframe.PastOneYear:
                return this.addYears(asOfDate, -1);
            case HistoryTimeframe.PastTwoYears:
                return this.addYears(asOfDate, -2);
            case HistoryTimeframe.PastFiveYears:
                return this.addYears(asOfDate, -5);
            case HistoryTimeframe.PastTenYears:
                return this.addYears(asOfDate, -10);
            case HistoryTimeframe.YearToDate:
                return `${asOfDate.substring(0, 4)}-01-01`;
            case HistoryTimeframe.All:
                return '1970-01-01';
        }
    }

    private static parse(value: CalendarDate): DateParts {
        if (!this.isValid(value)) {
            throw new Error(`Not a calendar date (YYYY-MM-DD): '${value}'`);
        }
        const [year, month, day] = value.split('-').map(Number);
        return { year, month, day };
    }

    private static format({ year, month, day }: DateParts): CalendarDate {
        return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }

    private static daysInMonth(year: number, month: number): number {
        return new Date(Date.UTC(year, month, 0)).getUTCDate();
    }
}
