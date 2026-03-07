import { GetTransactionsOptions } from '@shared/finance/contracts';
import { Account, Category, FinanceProfile, Institution, Transaction } from '@shared/finance/types';
import { FinanceData } from './../data-access/finance-data';

export class FinanceLogic {
    private financeData: FinanceData;

    constructor(financeData: FinanceData) {
        this.financeData = financeData;
    }

    public async getProfile(userId: string): Promise<FinanceProfile> {
        const profile = await this.financeData.getProfile(userId);

        // TODO: Logic class should "throw" a Bad Request
        if (!profile) {
            throw new Error(`Error: Finance Profile not found for user ID: ${userId}`);
        }

        return profile;
    }

    public async getCategories(userId: string): Promise<Category[]> {
        const data = await this.financeData.getCategories(userId);
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

    public async getTransactions(userId: string, options: GetTransactionsOptions, accountId?: string): Promise<Transaction[]> {
        const data = await this.financeData.getTransactions(userId, options, accountId);
        return data;
    }

    // TODO
    // public async getAccountBalanceHistory(accountId: string): Promise<OperationResponse<BalanceHistory[]>> {
    //     const data = await this.financeData.getAccountBalanceHistory(accountId);
    //     return createSuccessResponse<BalanceHistory[]>(data);
    // }
}