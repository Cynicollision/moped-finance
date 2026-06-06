import { OperationResult } from '@shared/common/contracts';
import { EntityIdPrefix } from '@shared/common/enum';
import { Institution } from '@shared/finance/types';
import { AppLogger } from '@core/logger';
import { EntityIdUtil, ResultUtil } from '@core/utility';
import { IFinanceInstitutionsData } from './../data/institutions-data';

export class InstitutionController {
    constructor(
        private logger: AppLogger,
        private institutions: IFinanceInstitutionsData
    ) {
    }

    public async getInstitution(userId: string, id: string): Promise<OperationResult<Institution>> {
        const institution = await this.institutions.retrieveSingle(userId, id);
        if (!institution) {
            return ResultUtil.userError('Institution not found or access denied');
        }
        return ResultUtil.success(institution);
    }

    public async getInstitutions(userId: string): Promise<OperationResult<Institution[]>> {
        return ResultUtil.success(await this.institutions.retrieveAll(userId));
    }

    public async createInstitution(userId: string, institution: Institution): Promise<OperationResult<Institution>> {
        institution.id = EntityIdUtil.generate(EntityIdPrefix.FinanceInstitution);
        institution.userId = userId;

        return ResultUtil.success(await this.institutions.insert(userId, institution));
    }

    public async updateInstitution(userId: string, institution: Institution): Promise<OperationResult<Institution>> {
        const updated = await this.institutions.update(userId, institution);
        if (!updated) {
            return ResultUtil.userError('Institution not found or access denied');
        }
        return ResultUtil.success(updated);
    }

    public async deleteInstitution(userId: string, id: string): Promise<OperationResult<void>> {
        const deleted = await this.institutions.delete(userId, id);
        if (!deleted) {
            return ResultUtil.userError('Institution not found or access denied');
        }
        return ResultUtil.success();
    }
}
