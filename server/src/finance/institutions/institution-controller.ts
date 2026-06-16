import { OperationResult } from '@shared/core/contracts';
import { NewEntity } from '@shared/core/types';
import { Institution } from '@shared/finance/types';
import { ResourceAccess } from '@server-core/auth';
import { IAppLogger } from '@server-core/logger';
import { Result } from '@server-core/utility';
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
            return Result.userError('Institution not found or access denied');
        }
        return Result.success(institution);
    }

    public async getInstitutions(userId: string): Promise<OperationResult<Institution[]>> {
        const institutions = await this.institutionData.retrieveAll(userId);
        return Result.success(institutions);
    }

    public async createInstitution(userId: string, newInsitution: NewEntity<Institution>): Promise<OperationResult<Institution>> {
        const institution = FinanceEntityFactory.createInstitution(userId, newInsitution);
        const created = await this.institutionData.insert(institution);
        return Result.successCreated(created);
    }

    public async updateInstitution(userId: string, institution: Institution): Promise<OperationResult<Institution>> {
        const current = await this.institutionData.retrieveSingle(institution.id);
        if (!ResourceAccess.validate(userId, current)) {
            return Result.userErrorNotFound();
        }

        const updated = await this.institutionData.update(institution);
        if (!updated) {
            return Result.userErrorNotFound();
        }

        return Result.successUpdated(updated);
    }

    public async deleteInstitution(userId: string, institutionId: string): Promise<OperationResult<boolean>> {
        const current = await this.institutionData.retrieveSingle(institutionId);
        if (!ResourceAccess.validate(userId, current)) {
            return Result.userErrorNotFound();
        }

        const deleted = await this.institutionData.delete(institutionId);
        if (!deleted) {
            return Result.userErrorNotFound();
        }

        return Result.successDeleted();
    }

    public async syncInstitution(userId: string, institutionId: string): Promise<OperationResult<any>> {
        // TODO: implement sync logic
        return Result.successCreated({ message: 'Sync institution logic stub' });
    }
}
