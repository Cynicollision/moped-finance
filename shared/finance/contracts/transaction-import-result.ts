export interface TransactionImportResult {
    /** Rows created, or that would be created on a dry run. Rows already imported aren't (TXN-3.12). */
    createdCount: number;
    /** Rows skipped because they're already in the app (TXN-3.12). */
    duplicateCount: number;
    /** One message per invalid row, such as "Row 3: Amount 'abc' is not a number." */
    failedRowMessages: string[];
    resultMessage: string;
    /** True when no row has an error. Imports are all-or-nothing, so only a valid file is saved. */
    isValidToImport: boolean;
    /** Rows that get no category: a blank CategoryName, "Uncategorized", or a name that isn't a category (TXN-3.4). */
    uncategorizedCount: number;
    /** CategoryNames that match no category, with the rows (numbered as in the file) that use them, so typos show. */
    unmatchedCategories: { name: string; rowNumbers: number[] }[];
}
