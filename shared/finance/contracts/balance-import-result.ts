export type BalanceImportResult = {
    startDate?: string;
    endDate?: string;
    createdCount?: number;
    failedRowMessages?: string[];
    resultMessage?: string;
    isValidToImport?: boolean;
};