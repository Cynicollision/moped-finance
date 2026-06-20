import { OperationResult } from '@shared/core/contracts';
import { NewEntity } from '@shared/core/types';
import { BudgetStream } from '@shared/finance/types';
import { IAppLogger } from '@server-core/logger';
import { OperationContext } from '@server-core/operation-handler';
import { Result } from '@server-core/utility';
import { FinanceEntityFactory } from './../common';
import { IFinanceBudgetStreamData } from './budget-stream-data';

export class BudgetStreamController {
    constructor(
        private logger: IAppLogger,
        private budgetStreamData: IFinanceBudgetStreamData) {
    }

    public async getBudgetStreams(context: OperationContext): Promise<OperationResult<BudgetStream[]>> {
        const streams = await this.budgetStreamData.retrieveAll(context.user.getId());
        return Result.success(streams);
    }

    public async createBudgetStream(context: OperationContext, newBudgetStream: NewEntity<BudgetStream>): Promise<OperationResult<BudgetStream>> {
        const budgetStream = FinanceEntityFactory.createBudgetStream(context.user.getId(), newBudgetStream);
        const created = await this.budgetStreamData.insert(budgetStream);
        return Result.successCreated(created);
    }

    public async saveBudgetStream(context: OperationContext, budgetStream: BudgetStream): Promise<OperationResult<BudgetStream>> {
        const current = await this.budgetStreamData.retrieveSingle(budgetStream.id);
        if (!current || !context.user.canAccess(current)) {
            return Result.userErrorNotFound();
        }

        const updated = await this.budgetStreamData.update(budgetStream);
        if (!updated) {
            return Result.userErrorNotFound();
        }

        return Result.successUpdated(updated);
    }

    public async deleteBudgetStream(context: OperationContext, budgetStreamId: string): Promise<OperationResult<void>> {
        const deleted = await this.budgetStreamData.delete(budgetStreamId);
        if (!deleted) {
            return Result.userError('Budget stream not found or access denied');
        }
        return Result.successDeleted();
    }
}
