import { OperationResult } from '@shared/types/common/operation-response';
import { Institution } from '@shared/types/finance/entities/institution';
import { Account } from '@shared/types/finance/entities/account';
import { Category } from '@shared/types/finance/entities/category';
import { FinanceProfile } from '@shared/types/finance/entities/profile';
import { Transaction } from '@shared/types/finance/entities/transaction';
import { OperationResultFactory } from '../utility/operation-result-factory';
import { FinanceData } from './../data/finance-data';

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

    public async getProfile(userId: string): Promise<OperationResult<FinanceProfile>> {
        const profile = await this.financeData.getProfile(userId);

        if (!profile) {
            return OperationResultFactory.error<FinanceProfile>('NOT_FOUND', `Error: Finance Profile not found for user ID: ${userId}`)
        }

        return OperationResultFactory.success(profile);
    }

    public async getInstitutions(userId: string): Promise<OperationResult<Institution[]>> {
        const data = await this.financeData.getInstitutions(userId);
        return OperationResultFactory.success<Institution[]>(data);
    }

    public async getAccounts(userId: string): Promise<OperationResult<Account[]>> {
        const data = await this.financeData.getAccounts(userId);
        return OperationResultFactory.success<Account[]>(data);
    }

    public async getCategories(userId: string): Promise<OperationResult<Category[]>> {
        const data = await this.financeData.getCategories(userId);
        return OperationResultFactory.success<Category[]>(data);
    }

    public async getTransactions(userId: string, options: GetTransactionsOptions): Promise<OperationResult<Transaction[]>> {
        // TODO: use options
        const data = await this.financeData.getTransactions(userId);
        return OperationResultFactory.success<Transaction[]>(data);
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