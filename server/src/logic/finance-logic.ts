import { OperationResponse } from '@shared/types/common/operation-response';
import { Institution } from '@shared/types/finance/entities/institution';
import { FinanceProfile } from '@shared/types/finance/entities/profile';
import { createSuccessResponse } from './../utility/api-response-util';
import { FinanceData } from './../data/finance-data';

export class FinanceLogic {
    private financeData: FinanceData;

    constructor(financeData?: FinanceData) {
        this.financeData = financeData || new FinanceData();
    }

    public async getFinanceProfile(profileId: string): Promise<OperationResponse<FinanceProfile>> {
        const [accounts, institutions] = await Promise.all([
            this.financeData.getAccounts(profileId),
            this.financeData.getInstitutions(profileId),
            //this.financeData.getCategories(profileId)
        ]);

        const profileData: FinanceProfile = {
            id: profileId,
            userId: '1', // TODO: Fetch from profile record
            accounts,
            institutions,
            //categories
        };

        return createSuccessResponse<FinanceProfile>(profileData);
    }

    public async getInstitutions(profileId: string): Promise<OperationResponse<Institution[]>> {
        const data = await this.financeData.getInstitutions(profileId);
        return createSuccessResponse<Institution[]>(data);
    }
}