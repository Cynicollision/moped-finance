import { SchemaUtil } from '@server/data';

export type CsvValueResult<T> =
    | { success: true, value: T }
    | { success: false, message: string };

const isoDatePattern = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/;
const usDatePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const amountPattern = /^([+-])?\$?(\d+|\d{1,3}(?:,\d{3})+)(?:\.(\d+))?$/;

/** Parses the text of one CSV cell. Messages name the field, so they read well as "Row N: <message>". */
export class CsvValue {

    /**
     * Accepts YYYY-MM-DD, an ISO timestamp (its date part, so older exports re-import) and M/D/YYYY.
     * Returns YYYY-MM-DD. Impossible dates such as 2026-02-30 are rejected.
     */
    public static date(field: string, text: string): CsvValueResult<string> {
        if (!text) {
            return { success: false, message: `${field} is required.` };
        }

        let year: number, month: number, day: number;
        const iso = isoDatePattern.exec(text);
        const us = usDatePattern.exec(text);
        if (iso) {
            [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
        }
        else if (us) {
            [year, month, day] = [Number(us[3]), Number(us[1]), Number(us[2])];
        }
        else {
            return { success: false, message: `${field} '${text}' is not a date; use YYYY-MM-DD or M/D/YYYY.` };
        }

        const date = new Date(Date.UTC(year, month - 1, day));
        if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
            return { success: false, message: `${field} '${text}' is not a valid date.` };
        }

        return { success: true, value: date.toISOString().substring(0, 10) };
    }

    /**
     * Accepts a plain number with an optional sign, `$` and thousands separators (-1,234.56, $12).
     * Rejects more than two decimal places and values too large for a money column.
     */
    public static amount(field: string, text: string): CsvValueResult<number> {
        if (!text) {
            return { success: false, message: `${field} is required.` };
        }

        const match = amountPattern.exec(text);
        if (!match) {
            return { success: false, message: `${field} '${text}' is not a number.` };
        }

        const [, sign, whole, fraction] = match;
        if (fraction !== undefined && fraction.length > 2) {
            return { success: false, message: `${field} '${text}' has more than two decimal places.` };
        }

        const value = Number(`${sign === '-' ? '-' : ''}${whole.replace(/,/g, '')}.${fraction ?? '0'}`);
        if (Math.abs(value) > SchemaUtil.maxMoneyAmount) {
            return { success: false, message: `${field} '${text}' is too large.` };
        }

        return { success: true, value };
    }

    /** Accepts true or false in any case; blank is false. */
    public static boolean(field: string, text: string): CsvValueResult<boolean> {
        const lower = text.toLowerCase();
        if (lower === 'true') {
            return { success: true, value: true };
        }
        if (lower === 'false' || lower === '') {
            return { success: true, value: false };
        }
        return { success: false, message: `${field} must be true, false or blank.` };
    }
}
