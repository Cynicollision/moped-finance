import { Transaction } from '@shared/finance/types';
import { Uncategorized } from '@shared/finance/util';
import { CsvColumn, CsvFile, CsvValue } from '@server/csv';
import { EntityFactory } from '@server/data';
import { TransactionExport } from './transaction-data';

const columns: CsvColumn<TransactionExport>[] = [
    { header: 'Id', value: t => t.id },
    { header: 'Date', value: t => t.date },
    { header: 'AccountName', value: t => t.accountName },
    { header: 'Merchant', value: t => t.merchant },
    { header: 'CategoryName', value: t => t.categoryName },
    { header: 'Amount', value: t => t.amount },
    { header: 'OriginalStatement', value: t => t.originalStatement },
    { header: 'Notes', value: t => t.notes },
    { header: 'IsHidden', value: t => t.isHidden }
];

const maxMerchantLength = 255;

export interface TransactionCsvLookups {
    /** Account IDs by lower-cased name. */
    accountIds: Map<string, string>;
    /** Category IDs by lower-cased name. */
    categoryIds: Map<string, string>;
    /** When set, every row goes to this account and AccountName is ignored (TXN-3.5). */
    targetAccountId?: string;
}

/** An import row's transaction-to-be, and the Id it had in the file ('' for none, TXN-3.2). */
export interface TransactionCsvRow {
    fileId: string;
    transaction: Transaction;
}

export type TransactionCsvReadResult =
    | {
          success: true;
          rows: TransactionCsvRow[];
          failedRowMessages: string[];
          /** CategoryNames that match no category, by first spelling, with the rows that use them (TXN-3.4). */
          unmatchedCategories: { name: string; rowNumbers: number[] }[];
      }
    | { success: false; message: string };

/** The transaction CSV format shared by export and import (TXN-3.1, TXN-3.2). */
export class TransactionCsv {
    public static write(transactions: TransactionExport[]): string {
        return CsvFile.write(columns, transactions);
    }

    /**
     * Reads an import file. A file-level problem fails the read; otherwise each valid row becomes a
     * transaction and each invalid row gets one message listing all of its problems.
     */
    public static read(file: Buffer | undefined, lookups: TransactionCsvLookups): TransactionCsvReadResult {
        // Free text is kept as written, so an export re-imports unchanged (TXN-3.1).
        // Id is optional (TXN-3.2). Free text is kept as written, so an export re-imports unchanged (TXN-3.1).
        const csv = CsvFile.read(
            file,
            columns.filter(c => c.header !== 'Id').map(c => c.header),
            ['Merchant', 'OriginalStatement', 'Notes']
        );
        if (!csv.success) {
            return csv;
        }

        const rows: TransactionCsvRow[] = [];
        const failedRowMessages: string[] = [];
        const unmatchedCategories = new Map<string, { name: string; rowNumbers: number[] }>();

        for (const row of csv.rows) {
            const values = row.values;
            const errors: string[] = row.error ? [row.error] : [];

            const accountId = lookups.targetAccountId ?? lookups.accountIds.get(values['AccountName'].toLowerCase());
            if (!accountId) {
                errors.push(`Account name '${values['AccountName']}' not found.`);
            }

            // A blank CategoryName, "Uncategorized", or a name that isn't a category leaves the row uncategorized. The
            // last is reported, so the user can catch a typo before importing (TXN-3.4).
            const categoryName = values['CategoryName'];
            const categoryId = lookups.categoryIds.get(categoryName.toLowerCase()) ?? '';
            if (categoryName && !categoryId && !Uncategorized.isName(categoryName)) {
                const key = categoryName.toLowerCase();
                const unmatched = unmatchedCategories.get(key) ?? { name: categoryName, rowNumbers: [] };
                unmatched.rowNumbers.push(row.rowNumber);
                unmatchedCategories.set(key, unmatched);
            }

            if (values['Merchant'].length > maxMerchantLength) {
                errors.push(`Merchant is longer than ${maxMerchantLength} characters.`);
            }

            const date = CsvValue.recordDate('Date', values['Date']);
            const amount = CsvValue.amount('Amount', values['Amount']);
            const isHidden = CsvValue.boolean('IsHidden', values['IsHidden']);
            for (const value of [date, amount, isHidden]) {
                if (!value.success) {
                    errors.push(value.message);
                }
            }

            if (errors.length > 0 || !accountId || !date.success || !amount.success || !isHidden.success) {
                failedRowMessages.push(`Row ${row.rowNumber}: ${errors.join(' ')}`);
                continue;
            }

            rows.push({
                fileId: values['Id'] ?? '',
                transaction: EntityFactory.createTransaction({
                    accountId,
                    categoryId,
                    date: date.value,
                    amount: amount.value,
                    merchant: values['Merchant'],
                    originalStatement: values['OriginalStatement'],
                    notes: values['Notes'],
                    isHidden: isHidden.value
                })
            });
        }

        return {
            success: true,
            rows,
            failedRowMessages,
            unmatchedCategories: [...unmatchedCategories.values()]
        };
    }
}
