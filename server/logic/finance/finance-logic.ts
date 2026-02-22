import { OperationResponse } from '@shared/types/common/operation-response';
import { Institution } from '@shared/types/finance/entities/institution';
import { createSuccessResponse } from './../../utility/api-response-util';

export class FinanceLogic {

    constructor() {
        // TODO: inject data provider here
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