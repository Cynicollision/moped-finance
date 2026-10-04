import { BalanceHistory } from '@shared/finance/types';
import { CsvColumn, CsvFile, CsvValue } from '@server/csv';
import { FinanceEntityFactory } from '@server/data';
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
     * row becomes a record, each invalid row gets one message listing its problems, and startDate and
     * endDate span the valid rows (YYYY-MM-DD).
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

            const date = CsvValue.date('Date', row.values['Date']);
            const balance = CsvValue.amount('Balance', row.values['Balance']);
            for (const value of [date, balance]) {
                if (!value.success) {
                    errors.push(value.message);
                }
            }

            // One balance per account per date (ACCT-3.9); the database enforces it too.
            if (date.success && seenDates.has(date.value)) {
                errors.push(`Duplicate date ${date.value}`);
            }

            if (errors.length > 0 || !date.success || !balance.success) {
                failedRowMessages.push(`Row ${row.rowNumber}: ${errors.join(' ')}`);
                continue;
            }

            seenDates.add(date.value);
            startDate = !startDate || date.value < startDate ? date.value : startDate;
            endDate = !endDate || date.value > endDate ? date.value : endDate;

            records.push(
                FinanceEntityFactory.createBalanceHistory({
                    accountId,
                    date: date.value,
                    balance: balance.value
                })
            );
        }

        return { success: true, records, failedRowMessages, startDate, endDate };
    }
}
