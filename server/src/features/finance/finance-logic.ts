import { OperationResponse } from '@shared/types/common/operation-response';
import { Institution } from '@shared/types/finance/entities/institution';
import { FinanceProfile } from '@shared/types/finance/entities/profile';
import { createSuccessResponse } from './../../utility/api-response-util';
import { AccountType } from '@shared/types/finance/enum/account-type';

export class FinanceLogic {

    constructor() {
        // TODO: inject data provider here
    }

    public getFinanceProfile(profileId: string): OperationResponse<FinanceProfile> {
        const profileData: FinanceProfile = {
            id: '1',
            userId: '1',
        };

        profileData.institutions = this.getTestInstitutions().data;
        profileData.categories = [];
        
        profileData.accounts = [
            {
                id: '1',
                institutionId: '1',
                name: 'Test Account 1',
                type: AccountType.Asset,
                subtype: 'Checking',
                hidden: false,
                balanceHistory: [],
                transactions: [],
            },
            {
                id: '2',
                institutionId: '1',
                name: 'Test Account 2',
                type: AccountType.Asset,
                subtype: 'Savings',
                hidden: false,
                balanceHistory: [],
                transactions: [],
            },
            {
                id: '2',
                institutionId: '1',
                name: 'Test Account 3',
                type: AccountType.Asset,
                subtype: 'Loan',
                hidden: false,
                balanceHistory: [],
                transactions: [],
            }
        ]

        return createSuccessResponse<FinanceProfile>(profileData);
    }

    public getTestInstitutions(): OperationResponse<Institution[]> {
        return createSuccessResponse<Institution[]>([
            {
                id: '1',
                profileId: '1',
                name: 'Test Institution 1'
            },
            {
                id: '2',
                profileId: '1',
                name: 'Test Institution 2'
            },
            {
                id: '3',
                profileId: '1',
                name: 'Test Institution 3'
            },
        ]);
    }
}