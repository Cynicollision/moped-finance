export type BalanceImportResult = {
    startDate?: string;
    endDate?: string;
    createdCount?: number;
    updatedCount?: number;
    failedRowMessages?: string[];
    resultMessage?: string;
    isValidToImport?: boolean;
};