import { Account, Category, FinanceProfile, Institution, Transaction } from '@shared/types/entities/finance';
import { FinanceData } from './../data-access/finance-data';

type GetTransactionsOptions = {
    sort: string;
    direction: string;
    offset: number;
    limit: number;
};

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
            //return OperationResultFactory.error<FinanceProfile>('NOT_FOUND', `Error: Finance Profile not found for user ID: ${userId}`)
        }

        return profile;
    }

    public async getInstitutions(userId: string): Promise<Institution[]> {
        const data = await this.financeData.getInstitutions(userId);
        return data;
    }

    public async getAccounts(userId: string): Promise<Account[]> {
        const data = await this.financeData.getAccounts(userId);
        return data;
    }

    public async getCategories(userId: string): Promise<Category[]> {
        const data = await this.financeData.getCategories(userId);
        return data;
    }

    public async getTransactions(userId: string, options: GetTransactionsOptions): Promise<Transaction[]> {
        // TODO: use options
        const data = await this.financeData.getTransactions(userId);
        return data;
    }

    // TODO
    // public async getAccountTransactions(accountId: string): Promise<OperationResponse<Transaction[]>> {
    //     const data = await this.financeData.getAccountTransactions(accountId);
    //     return createSuccessResponse<Transaction[]>(data);
    // }

    // public async getAccountBalanceHistory(accountId: string): Promise<OperationResponse<BalanceHistory[]>> {
    //     const data = await this.financeData.getAccountBalanceHistory(accountId);
    //     return createSuccessResponse<BalanceHistory[]>(data);
    // }
}