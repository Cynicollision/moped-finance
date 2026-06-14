export type TransactionImportResult = {
    createdCount?: number;
    updatedCount?: number;
    failedRowMessages?: string[];
    resultMessage?: string;
    isValidToImport?: boolean;
};