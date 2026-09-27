import { CalendarPeriod, HistoryTimeframe } from './../enum';
import { CalendarDateUtil } from './calendar-date-util';

describe('CalendarDateUtil', () => {
    it.each([
        ['2026-05-01', true],
        ['2024-02-29', true],
        ['2026-02-29', false],
        ['2026-04-31', false],
        ['2026-13-01', false],
        ['2026-5-1', false],
        ['2026-05-01T00:00:00.000Z', false],
        ['05/01/2026', false],
        ['', false]
    ])('APP-5.7 should accept only real dates written YYYY-MM-DD (%p)', (value, expected) => {
        expect(CalendarDateUtil.isValid(value)).toBe(expected);
    });

    it('should convert to and from a local Date without shifting the day', () => {
        const date = CalendarDateUtil.toDate('2026-05-01');

        expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 4, 1, 0]);
        expect(CalendarDateUtil.fromDate(date)).toBe('2026-05-01');
        expect(CalendarDateUtil.fromDate(new Date(2026, 11, 31, 23, 59))).toBe('2026-12-31');
    });

    it('should add days across month and year ends', () => {
        expect(CalendarDateUtil.addDays('2026-05-17', -30)).toBe('2026-04-17');
        expect(CalendarDateUtil.addDays('2026-12-31', 1)).toBe('2027-01-01');
        expect(CalendarDateUtil.addDays('2024-03-01', -1)).toBe('2024-02-29');
    });

    it('should add months and years, clamping to the end of a shorter month', () => {
        expect(CalendarDateUtil.addMonths('2026-03-31', -1)).toBe('2026-02-28');
        expect(CalendarDateUtil.addMonths('2026-11-15', 3)).toBe('2027-02-15');
        expect(CalendarDateUtil.addYears('2024-02-29', -1)).toBe('2023-02-28');
    });

    it.each([
        [CalendarPeriod.Monthly, '2026-04-15', '2026-04-01', '2026-04-30'],
        [CalendarPeriod.Monthly, '2024-02-01', '2024-02-01', '2024-02-29'],
        [CalendarPeriod.Quarterly, '2026-05-17', '2026-04-01', '2026-06-30'],
        [CalendarPeriod.Quarterly, '2026-12-31', '2026-10-01', '2026-12-31'],
        [CalendarPeriod.Yearly, '2026-05-17', '2026-01-01', '2026-12-31']
    ])('CASH-1.2 should give the whole %s period around %s, both ends included', (period, asOfDate, startDate, endDate) => {
        expect(CalendarDateUtil.getPeriod(period, asOfDate)).toEqual({ startDate, endDate });
    });

    it.each([
        [HistoryTimeframe.PastThirtyDays, '2026-04-17'],
        [HistoryTimeframe.PastSixtyDays, '2026-03-18'],
        [HistoryTimeframe.PastNinetyDays, '2026-02-16'],
        [HistoryTimeframe.PastOneYear, '2025-05-17'],
        [HistoryTimeframe.PastTwoYears, '2024-05-17'],
        [HistoryTimeframe.PastFiveYears, '2021-05-17'],
        [HistoryTimeframe.PastTenYears, '2016-05-17'],
        [HistoryTimeframe.YearToDate, '2026-01-01'],
        [HistoryTimeframe.All, '1970-01-01']
    ])('ACCT-2.4 should start %s on %s when counting back from 2026-05-17', (timeframe, expected) => {
        expect(CalendarDateUtil.getTimeframeStart(timeframe, '2026-05-17')).toBe(expected);
    });

    it('should refuse to work with a value that is not a calendar date', () => {
        expect(() => CalendarDateUtil.addDays('2026-05-01T00:00:00.000Z', 1)).toThrow('Not a calendar date');
    });
});
