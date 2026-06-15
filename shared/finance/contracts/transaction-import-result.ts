export type TransactionImportResult = {
    createdCount?: number;
    failedRowMessages?: string[];
    resultMessage?: string;
    isValidToImport?: boolean;
};