import { GetTransactionsOptions } from '@shared/finance/contracts';
import { Account, BalanceHistory, Category, FinanceProfile, Institution, Transaction } from '@shared/finance/types';
import { FinanceData } from './../data-access/finance-data';

export class FinanceLogic {
    private financeData: FinanceData;

    constructor(financeData: FinanceData) {
        this.financeData = financeData;
    }

    public async getProfile(userId: string): Promise<FinanceProfile> {
        const profile = await this.financeData.getProfile(userId);

        // TODO: Logic classes should validate and "throw" a Bad Request
        if (!profile) {
            throw new Error(`Error: Finance Profile not found for user ID: ${userId}`);
        }

        return profile;
    }

    public async getCategories(userId: string, activeOnly: boolean = false): Promise<Category[]> {
        const data = await this.financeData.getCategories(userId, activeOnly);
        return data;
    }

    public async getInstitutions(userId: string): Promise<Institution[]> {
        const data = await this.financeData.getInstitutions(userId);
        return data;
    }

    public async getAccounts(userId: string): Promise<Account[]> {
        const data = await this.financeData.getAccounts(userId);
        return data;
    }

    public async getAccountBalanceHistory(userId: string, accountId: string, options: GetTransactionsOptions): Promise<BalanceHistory[]> {
        const data = await this.financeData.getAccountBalanceHistory(userId, accountId, options);
        return data;
    }

    public async getTransactions(userId: string, options: GetTransactionsOptions, accountId?: string): Promise<Transaction[]> {
        const data = await this.financeData.getTransactions(userId, options, accountId);
        return data;
    }

    public async getTransactionMerchants(userId: string): Promise<string[]> {
        const data = await this.financeData.getTransactionMerchants(userId);
        return data;
    }
}