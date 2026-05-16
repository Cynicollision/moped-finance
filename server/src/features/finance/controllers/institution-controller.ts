import { OperationResult } from '@shared/common/contracts';
import { Institution } from '@shared/finance/types';
import { ResultUtil } from '@core/utility';
import { IFinanceInstitutionsData } from './../data/institutions-data';
import { AppLogger } from '@core/logger';

export class InstitutionController {
    constructor(
        private logger: AppLogger,
        private institutions: IFinanceInstitutionsData
    ) {
    }

    public async getInstitutions(userId: string): Promise<OperationResult<Institution[]>> {
        return ResultUtil.success(await this.institutions.retrieveAll(userId));
    }
}
