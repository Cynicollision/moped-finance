import Papa from 'papaparse';

/** One data row. `rowNumber` counts the header as row 1, matching what a spreadsheet shows for simple files. */
export type CsvRow = {
    rowNumber: number;
    /** Trimmed text by header name; a column missing from this row is ''. */
    values: Record<string, string>;
    /** Set when the row has the wrong number of columns. */
    error?: string;
};

export type CsvReadResult = { success: true; rows: CsvRow[] } | { success: false; message: string };

export type CsvColumn<T> = {
    header: string;
    value: (row: T) => string | number | boolean;
};

export class CsvFile {
    /**
     * Parses a CSV with a header row. File-level problems (no file, unparseable, a required header
     * missing, no data rows) fail the whole read. A row with the wrong number of columns comes back
     * with `error` set, so the caller can report it alongside its own row checks.
     */
    public static read(file: Buffer | undefined, requiredHeaders: string[]): CsvReadResult {
        if (!file) {
            return { success: false, message: 'No file provided.' };
        }

        const text = file.toString('utf8').replace(/^﻿/, '');
        const parsed = Papa.parse<Record<string, string | undefined>>(text, {
            header: true,
            skipEmptyLines: 'greedy',
            transformHeader: h => h.trim()
        });

        const headers = parsed.meta.fields ?? [];
        const rowErrors = new Map<number, string>();
        for (const error of parsed.errors) {
            if (error.type === 'FieldMismatch' && error.row !== undefined) {
                rowErrors.set(error.row, `Expected ${headers.length} columns.`);
            } else {
                return { success: false, message: `Could not parse the CSV file: ${error.message}` };
            }
        }

        const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
        if (missingHeaders.length > 0) {
            return { success: false, message: 'Missing required CSV headers: ' + missingHeaders.join(', ') };
        }

        if (parsed.data.length === 0) {
            return { success: false, message: 'The CSV file has no data rows.' };
        }

        const rows = parsed.data.map((record, index): CsvRow => {
            const values: Record<string, string> = {};
            for (const header of headers) {
                values[header] = (record[header] ?? '').trim();
            }
            return { rowNumber: index + 2, values, error: rowErrors.get(index) };
        });

        return { success: true, rows };
    }

    /** Writes a CSV with a header row and a final newline, so an empty list is just the header. */
    public static write<T>(columns: CsvColumn<T>[], rows: T[]): string {
        const data = rows.map(row => columns.map(column => column.value(row)));
        return Papa.unparse({ fields: columns.map(c => c.header), data }, { newline: '\n' }) + '\n';
    }
}
