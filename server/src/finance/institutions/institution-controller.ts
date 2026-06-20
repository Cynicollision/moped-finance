import { OperationResult } from '@shared/core/contracts';
import { NewEntity } from '@shared/core/types';
import { Institution } from '@shared/finance/types';
import { FinanceEntityFactory } from '@server-core/data';
import { IAppLogger } from '@server-core/logging';
import { OperationContext, Result } from '@server-core/routing';
import { IFinanceInstitutionData } from './institution-data';

export class InstitutionController {
    constructor(
        private logger: IAppLogger,
        private institutionData: IFinanceInstitutionData
    ) {
    }

    public async getInstitution(context: OperationContext, institutionId: string): Promise<OperationResult<Institution>> {
        const institution = await this.institutionData.retrieveSingle(institutionId);
        if (!institution) {
            return Result.userError('Institution not found or access denied');
        }
        return Result.success(institution);
    }

    public async getInstitutions(context: OperationContext): Promise<OperationResult<Institution[]>> {
        const institutions = await this.institutionData.retrieveAll(context.user.getId());
        return Result.success(institutions);
    }

    public async createInstitution(context: OperationContext, newInsitution: NewEntity<Institution>): Promise<OperationResult<Institution>> {
        const institution = FinanceEntityFactory.createInstitution(context.user.getId(), newInsitution);
        const created = await this.institutionData.insert(institution);
        return Result.successCreated(created);
    }

    public async updateInstitution(context: OperationContext, institution: Institution): Promise<OperationResult<Institution>> {
        const current = await this.institutionData.retrieveSingle(institution.id);
        if (!context.user.canAccess(current)) {
            return Result.userErrorNotFound();
        }

        const updated = await this.institutionData.update(institution);
        if (!updated) {
            return Result.userErrorNotFound();
        }

        return Result.successUpdated(updated);
    }

    public async deleteInstitution(context: OperationContext, institutionId: string): Promise<OperationResult<boolean>> {
        const current = await this.institutionData.retrieveSingle(institutionId);
        if (!context.user.canAccess(current)) {
            return Result.userErrorNotFound();
        }

        const deleted = await this.institutionData.delete(institutionId);
        if (!deleted) {
            return Result.userErrorNotFound();
        }

        return Result.successDeleted();
    }

    public async syncInstitution(context: OperationContext, institutionId: string): Promise<OperationResult<any>> {
        // TODO: implement sync logic
        return Result.successCreated({ message: 'Sync institution logic stub' });
    }
}
