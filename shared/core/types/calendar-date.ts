/**
 * A day on the calendar, written YYYY-MM-DD, with no time of day or time zone: a transaction's date, a balance's date,
 * the as-of date of a report. It means the same day wherever it's read, so never convert one through a `Date` in UTC
 * (`toISOString`, `new Date('2026-05-01')`); use `CalendarDateUtil`.
 */
export type CalendarDate = string;
