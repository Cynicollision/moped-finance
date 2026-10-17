import { CalendarDate } from '@shared/core/types';
import { Account, Institution } from '@shared/finance/types';
import { EntityFactory } from '@server/data';
import { IAppLogger } from '@server/logging';
import { OperationContext, OperationResult, Result } from '@server/routing';
import { IAccountData } from './../accounts';
import { IInstitutionData } from './institution-data';
import { CreateInstitutionRequest, UpdateInstitutionRequest } from './institution-schema';

export class InstitutionController {
    constructor(
        private logger: IAppLogger,
        private institutionData: IInstitutionData,
        private accountData: IAccountData
    ) {}

    public async getInstitution(
        context: OperationContext,
        institutionId: string
    ): Promise<OperationResult<Institution>> {
        const institution = await this.institutionData.retrieveSingle(institutionId);
        if (!institution) {
            return Result.userErrorNotFound();
        }
        return Result.success(institution);
    }

    public async getInstitutions(_context: OperationContext): Promise<OperationResult<Institution[]>> {
        const institutions = await this.institutionData.retrieveAll();
        return Result.success(institutions);
    }

    public async getInstitutionAccounts(
        context: OperationContext,
        institutionId: string,
        asOfDate?: CalendarDate
    ): Promise<OperationResult<Account[]>> {
        const current = await this.institutionData.retrieveSingle(institutionId);
        if (!current) {
            return Result.userErrorNotFound();
        }

        const accounts = await this.accountData.retrieveByInstitutionId(institutionId, asOfDate);
        return Result.success(accounts);
    }

    public async createInstitution(
        context: OperationContext,
        input: CreateInstitutionRequest
    ): Promise<OperationResult<Institution>> {
        const institution = EntityFactory.createInstitution(input);
        const created = await this.institutionData.insert(institution);
        return Result.successCreated(created);
    }

    public async updateInstitution(
        context: OperationContext,
        institutionId: string,
        changes: UpdateInstitutionRequest
    ): Promise<OperationResult<Institution>> {
        const current = await this.institutionData.retrieveSingle(institutionId);
        if (!current) {
            return Result.userErrorNotFound();
        }

        const updated = await this.institutionData.update({ ...current, ...changes });
        if (!updated) {
            return Result.userErrorNotFound();
        }

        return Result.successUpdated(updated);
    }

    public async deleteInstitution(context: OperationContext, institutionId: string): Promise<OperationResult<void>> {
        // An institution that still has accounts fails the delete's foreign key (ON DELETE RESTRICT),
        // which OperationHandler reports as a 400.
        const deleted = await this.institutionData.delete(institutionId);
        if (!deleted) {
            return Result.userErrorNotFound();
        }

        return Result.successDeleted();
    }

    public async syncInstitution(
        _context: OperationContext,
        _institutionId: string
    ): Promise<OperationResult<{ message: string }>> {
        // TODO: implement sync logic
        return Result.successCreated({ message: 'Sync institution logic stub' });
    }
}
