import { OperationResult } from '@shared/core/contracts';
import { NewEntity } from '@shared/core/types';
import { Institution } from '@shared/finance/types';
import { IAppLogger } from '@server-core/logger';
import { ResultUtil } from '@server-core/utility';
import { FinanceEntityFactory } from './../common';
import { IFinanceInstitutionData } from './institution-data';

export class InstitutionController {
    constructor(
        private logger: IAppLogger,
        private institutionData: IFinanceInstitutionData
    ) {
    }

    public async getInstitution(userId: string, institutionId: string): Promise<OperationResult<Institution>> {
        const institution = await this.institutionData.retrieveSingle(institutionId);
        if (!institution) {
            return ResultUtil.userError('Institution not found or access denied');
        }
        return ResultUtil.success(institution);
    }

    public async getInstitutions(userId: string): Promise<OperationResult<Institution[]>> {
        return ResultUtil.success(await this.institutionData.retrieveAll(userId));
    }

    public async createInstitution(userId: string, newInsitution: NewEntity<Institution>): Promise<OperationResult<Institution>> {
        const institution = FinanceEntityFactory.createInstitution(userId, newInsitution);
        return ResultUtil.success(await this.institutionData.insert(institution));
    }

    public async updateInstitution(userId: string, institution: Institution): Promise<OperationResult<Institution>> {
        const updated = await this.institutionData.update(institution);
        if (!updated) {
            return ResultUtil.userError('Institution not found or access denied');
        }
        return ResultUtil.success(updated);
    }

    public async deleteInstitution(userId: string, institutionId: string): Promise<OperationResult<void>> {
        const deleted = await this.institutionData.delete(institutionId);
        if (!deleted) {
            return ResultUtil.userError('Institution not found or access denied');
        }
        return ResultUtil.success();
    }

    public async syncInstitution(userId: string, institutionId: string): Promise<OperationResult<any>> {
        // TODO: implement sync logic
        return ResultUtil.success({ message: 'Sync institution logic stub' });
    }
}
