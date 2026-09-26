export type BalanceImportResult = {
    /** Earliest and latest dates in the file (YYYY-MM-DD); the import replaces existing balances in this range. */
    startDate: string;
    endDate: string;
    /** Rows created, or that would be created on a dry run. */
    createdCount: number;
    /** One message per invalid row, such as "Row 3: Duplicate date 2026-06-06". */
    failedRowMessages: string[];
    resultMessage: string;
    /** True when no row has an error. Imports are all-or-nothing, so only a valid file is saved. */
    isValidToImport: boolean;
};
