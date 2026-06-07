import { OperationResult } from '@shared/core/contracts';
import { FinanceEntityIdPrefix } from '@shared/finance/enum';
import { BudgetStream } from '@shared/finance/types';
import { AppLogger } from '@core/logger';
import { EntityIdUtil, ResultUtil } from '@core/utility';
import { IFinanceBudgetStreamData } from './budget-stream-data';

export class BudgetStreamController {
    private readonly logger: AppLogger;
    private readonly budgetStreamData: IFinanceBudgetStreamData;

    constructor(logger: AppLogger, budgetStreamData: IFinanceBudgetStreamData) {
        this.logger = logger;
        this.budgetStreamData = budgetStreamData;
    }

    public async getBudgetStreams(userId: string): Promise<OperationResult<BudgetStream[]>> {
        const streams = await this.budgetStreamData.retrieveAll(userId).catch(() => []);
        return ResultUtil.success(streams);
    }

    public async createBudgetStream(userId: string, budgetStream: BudgetStream): Promise<OperationResult<BudgetStream>> {
        budgetStream.id = EntityIdUtil.generate(FinanceEntityIdPrefix.BudgetStream);
        budgetStream.userId = userId;
        return ResultUtil.success(await this.budgetStreamData.insert(userId, budgetStream));
    }

    public async saveBudgetStream(userId: string, budgetStream: BudgetStream): Promise<OperationResult<BudgetStream>> {
        const updated = await this.budgetStreamData.update(userId, budgetStream);
        if (!updated) {
            return ResultUtil.userError('Budget stream not found or access denied');
        }
        return ResultUtil.success(updated);
    }

    public async deleteBudgetStream(userId: string, budgetStreamId: string): Promise<OperationResult<void>> {
        const deleted = await this.budgetStreamData.delete(userId, budgetStreamId);
        if (!deleted) {
            return ResultUtil.userError('Budget stream not found or access denied');
        }
        return ResultUtil.success();
    }
}
