import { OperationResponse } from '@shared/types/common/operation-response';
import { AccountCategory, AccountType, AccountSubType } from '@shared/types/finance/entities/account';
import { Institution } from '@shared/types/finance/entities/institution';
import { FinanceProfile } from '@shared/types/finance/entities/profile';
import { createSuccessResponse } from './../../utility/api-response-util';

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
                profileId: '1',
                institutionId: '1',
                name: 'Test Account 1',
                category: AccountCategory.Asset,
                type: AccountType.Cash,
                subtype: AccountSubType.Checking,
                balance: 1000,
                hidden: false,
                balanceHistory: [],
                transactions: [],
            },
            {
                id: '2',
                profileId: '1',
                institutionId: '1',
                name: 'Test Account 2',
                category: AccountCategory.Asset,
                type: AccountType.Cash,
                subtype: AccountSubType.Savings,
                balance: 2000,
                hidden: false,
                balanceHistory: [],
                transactions: [],
            },
            {
                id: '3',
                profileId: '1',
                institutionId: '1',
                name: 'Test Account 3',
                category: AccountCategory.Asset,
                type: AccountType.Mortgage,
                balance: 3000,
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