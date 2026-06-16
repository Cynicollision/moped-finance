import { OperationResult } from '@shared/core/contracts';
import { NewEntity } from '@shared/core/types';
import { BudgetStream } from '@shared/finance/types';
import { ResourceAccess } from '@server-core/auth';
import { IAppLogger } from '@server-core/logger';
import { Result } from '@server-core/utility';
import { FinanceEntityFactory } from './../common';
import { IFinanceBudgetStreamData } from './budget-stream-data';

export class BudgetStreamController {
    constructor(
        private logger: IAppLogger,
        private budgetStreamData: IFinanceBudgetStreamData) {
    }

    public async getBudgetStreams(userId: string): Promise<OperationResult<BudgetStream[]>> {
        const streams = await this.budgetStreamData.retrieveAll(userId);
        return Result.success(streams);
    }

    public async createBudgetStream(userId: string, newBudgetStream: NewEntity<BudgetStream>): Promise<OperationResult<BudgetStream>> {
        const budgetStream = FinanceEntityFactory.createBudgetStream(userId, newBudgetStream);
        const created = await this.budgetStreamData.insert(budgetStream);
        return Result.successCreated(created);
    }

    public async saveBudgetStream(userId: string, budgetStream: BudgetStream): Promise<OperationResult<BudgetStream>> {
        const current = await this.budgetStreamData.retrieveSingle(budgetStream.id);
        if (!current || !ResourceAccess.validate(userId, current)) {
            return Result.userErrorNotFound();
        }

        const updated = await this.budgetStreamData.update(budgetStream);
        if (!updated) {
            return Result.userErrorNotFound();
        }

        return Result.successUpdated(updated);
    }

    public async deleteBudgetStream(userId: string, budgetStreamId: string): Promise<OperationResult<void>> {
        const deleted = await this.budgetStreamData.delete(budgetStreamId);
        if (!deleted) {
            return Result.userError('Budget stream not found or access denied');
        }
        return Result.successDeleted();
    }
}
