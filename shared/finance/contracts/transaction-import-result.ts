export type TransactionImportResult = {
    /** Rows created, or that would be created on a dry run. */
    createdCount: number;
    /** One message per invalid row, such as "Row 3: Amount 'abc' is not a number." */
    failedRowMessages: string[];
    resultMessage: string;
    /** True when no row has an error. Imports are all-or-nothing, so only a valid file is saved. */
    isValidToImport: boolean;
};
