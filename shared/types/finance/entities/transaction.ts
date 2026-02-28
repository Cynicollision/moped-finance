export type Transaction = {
    id: string;
    accountId: string;
    categoryId: string;
    date: string;
    amount: number;
    merchant: string;
    originalStatement: string;
    notes: string;
    isHidden: boolean;
    isSplit: boolean;
    splitParentId: string;
};