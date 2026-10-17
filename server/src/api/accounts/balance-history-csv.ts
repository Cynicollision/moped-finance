import { BalanceEntrySource } from '@shared/finance/enum';
import { BalanceHistory } from '@shared/finance/types';
import { CsvColumn, CsvFile, CsvValue } from '@server/csv';
import { EntityFactory } from '@server/data';
import { BalanceHistoryExport } from './balance-history-data';

const columns: CsvColumn<BalanceHistoryExport>[] = [
    { header: 'Date', value: b => b.date },
    { header: 'AccountName', value: b => b.accountName },
    { header: 'Balance', value: b => b.balance }
];

// AccountName is written for readability but ignored on import: the account comes from the URL.
const requiredHeaders = ['Date', 'Balance'];

export type BalanceHistoryCsvReadResult =
    | { success: true; records: BalanceHistory[]; failedRowMessages: string[]; startDate: string; endDate: string }
    | { success: false; message: string };

/** The balance history CSV format shared by export and import (ACCT-3.1, ACCT-3.2). */
export class BalanceHistoryCsv {
    public static write(history: BalanceHistoryExport[]): string {
        return CsvFile.write(columns, history);
    }

    /**
     * Reads an import file for one account. A file-level problem fails the read; otherwise each valid
     * row becomes a set entry (ACCT-3.5), each invalid row gets one message listing its problems, and startDate and
     * endDate span every row with a valid date, bad rows included (ACCT-3.3).
     */
    public static read(file: Buffer | undefined, accountId: string): BalanceHistoryCsvReadResult {
        const csv = CsvFile.read(file, requiredHeaders);
        if (!csv.success) {
            return csv;
        }

        const records: BalanceHistory[] = [];
        const failedRowMessages: string[] = [];
        const seenDates = new Set<string>();
        let startDate = '';
        let endDate = '';

        for (const row of csv.rows) {
            const errors: string[] = row.error ? [row.error] : [];

            const date = CsvValue.recordDate('Date', row.values['Date']);
            const balance = CsvValue.amount('Balance', row.values['Balance']);
            for (const value of [date, balance]) {
                if (!value.success) {
                    errors.push(value.message);
                }
            }

            if (date.success) {
                // One balance per account per date (ACCT-3.9); the database enforces it too.
                if (seenDates.has(date.value)) {
                    errors.push(`Duplicate date ${date.value}`);
                }
                seenDates.add(date.value);
                startDate = !startDate || date.value < startDate ? date.value : startDate;
                endDate = !endDate || date.value > endDate ? date.value : endDate;
            }

            if (errors.length > 0 || !date.success || !balance.success) {
                failedRowMessages.push(`Row ${row.rowNumber}: ${errors.join(' ')}`);
                continue;
            }

            records.push(
                EntityFactory.createBalanceHistory({
                    accountId,
                    date: date.value,
                    balance: balance.value,
                    source: BalanceEntrySource.Set
                })
            );
        }

        return { success: true, records, failedRowMessages, startDate, endDate };
    }
}
