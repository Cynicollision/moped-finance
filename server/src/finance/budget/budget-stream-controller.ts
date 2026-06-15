import { OperationResult } from '@shared/core/contracts';
import { NewEntity } from '@shared/core/types';
import { BudgetStream } from '@shared/finance/types';
import { IAppLogger } from '@server-core/logger';
import { ResultUtil } from '@server-core/utility';
import { FinanceEntityFactory } from './../common';
import { IFinanceBudgetStreamData } from './budget-stream-data';

export class BudgetStreamController {
    constructor(
        private logger: IAppLogger,
        private budgetStreamData: IFinanceBudgetStreamData) {
    }

    public async getBudgetStreams(userId: string): Promise<OperationResult<BudgetStream[]>> {
        const streams = await this.budgetStreamData.retrieveAll(userId).catch(() => []);
        return ResultUtil.success(streams);
    }

    public async createBudgetStream(userId: string, newBudgetStream: NewEntity<BudgetStream>): Promise<OperationResult<BudgetStream>> {
        const budgetStream = FinanceEntityFactory.createBudgetStream(userId, newBudgetStream);
        return ResultUtil.success(await this.budgetStreamData.insert(budgetStream));
    }

    public async saveBudgetStream(userId: string, budgetStream: BudgetStream): Promise<OperationResult<BudgetStream>> {
        const updated = await this.budgetStreamData.update(budgetStream);
        if (!updated) {
            return ResultUtil.userError('Budget stream not found or access denied');
        }
        return ResultUtil.success(updated);
    }

    public async deleteBudgetStream(userId: string, budgetStreamId: string): Promise<OperationResult<void>> {
        const deleted = await this.budgetStreamData.delete(budgetStreamId);
        if (!deleted) {
            return ResultUtil.userError('Budget stream not found or access denied');
        }
        return ResultUtil.success();
    }
}
