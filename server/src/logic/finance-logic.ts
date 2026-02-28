import { OperationResponse } from '@shared/types/common/operation-response';
import { Institution } from '@shared/types/finance/entities/institution';
import { FinanceProfile } from '@shared/types/finance/entities/profile';
import { Transaction } from '@shared/types/finance/entities/transaction';
import { BalanceHistory } from '@shared/types/finance/entities/balance-history';
import { createErrorResponse, createSuccessResponse } from './../utility/api-response-util';
import { FinanceData } from './../data/finance-data';

export class FinanceLogic {
    private financeData: FinanceData;

    constructor(financeData?: FinanceData) {
        this.financeData = financeData || new FinanceData();
    }

    public async getFinanceProfileByUserId(userId: string): Promise<OperationResponse<FinanceProfile>> {
        const profile = await this.financeData.getProfileByUserId(userId);

        if (!profile) {
            return createErrorResponse<FinanceProfile>('NOT_FOUND', `Error: Finance Profile not found for user ID: ${userId}`)
        }

        return await this.getFinanceProfile(profile.id);
    }

    public async getFinanceProfile(profileId: string): Promise<OperationResponse<FinanceProfile>> {
        const [accounts, institutions, categories] = await Promise.all([
            this.financeData.getAccounts(profileId),
            this.financeData.getInstitutions(profileId),
            this.financeData.getCategories(profileId)
        ]);

        const profileData: FinanceProfile = {
            id: profileId,
            userId: '1', // TODO: Fetch from profile record
            accounts,
            institutions,
            categories
        };

        return createSuccessResponse<FinanceProfile>(profileData);
    }

    public async getInstitutions(profileId: string): Promise<OperationResponse<Institution[]>> {
        const data = await this.financeData.getInstitutions(profileId);
        return createSuccessResponse<Institution[]>(data);
    }

    public async getAccountTransactions(accountId: string): Promise<OperationResponse<Transaction[]>> {
        const data = await this.financeData.getTransactions(accountId);
        return createSuccessResponse<Transaction[]>(data);
    }

    public async getAccountBalanceHistory(accountId: string): Promise<OperationResponse<BalanceHistory[]>> {
        const data = await this.financeData.getBalanceHistory(accountId);
        return createSuccessResponse<BalanceHistory[]>(data);
    }
}