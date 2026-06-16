import { OperationResult } from '@shared/core/contracts';
import { NewEntity } from '@shared/core/types';
import { BudgetStream } from '@shared/finance/types';
import { IAppLogger } from '@server-core/logger';
import { Result } from '@server-core/utility';
import { FinanceEntityFactory } from './../common';
import { IFinanceBudgetStreamData } from './budget-stream-data';

// TODO: resource ownership logic (update)
export class BudgetStreamController {
    constructor(
        private logger: IAppLogger,
        private budgetStreamData: IFinanceBudgetStreamData) {
    }

    public async getBudgetStreams(userId: string): Promise<OperationResult<BudgetStream[]>> {
        const streams = await this.budgetStreamData.retrieveAll(userId).catch(() => []);
        return Result.success(streams);
    }

    public async createBudgetStream(userId: string, newBudgetStream: NewEntity<BudgetStream>): Promise<OperationResult<BudgetStream>> {
        const budgetStream = FinanceEntityFactory.createBudgetStream(userId, newBudgetStream);
        return Result.success(await this.budgetStreamData.insert(budgetStream));
    }

    public async saveBudgetStream(userId: string, budgetStream: BudgetStream): Promise<OperationResult<BudgetStream>> {
        const updated = await this.budgetStreamData.update(budgetStream);
        if (!updated) {
            return Result.userError('Budget stream not found or access denied');
        }
        return Result.success(updated);
    }

    public async deleteBudgetStream(userId: string, budgetStreamId: string): Promise<OperationResult<void>> {
        const deleted = await this.budgetStreamData.delete(budgetStreamId);
        if (!deleted) {
            return Result.userError('Budget stream not found or access denied');
        }
        return Result.success();
    }
}
