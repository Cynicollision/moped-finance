import { OperationResult } from '@shared/common/contracts';
import { EntityIdPrefix } from '@shared/common/enum';
import { BudgetStream } from '@shared/finance/types';
import { AppLogger } from '@core/logger';
import { EntityIdUtil, ResultUtil } from '@core/utility';
import { IFinanceBudgetStreamData } from './budget-stream-data';

export class BudgetStreamController {

    constructor(private logger: AppLogger, private budgetStreamData: IFinanceBudgetStreamData) {
    }

    public async getBudgetStreams(userId: string): Promise<OperationResult<BudgetStream[]>> {
        const streams = await this.budgetStreamData.retrieveAll(userId).catch(() => []);
        return ResultUtil.success(streams);
    }

    public async createBudgetStream(userId: string, stream: BudgetStream): Promise<OperationResult<BudgetStream>> {
        stream.id = EntityIdUtil.generate(EntityIdPrefix.FinanceBudgetStream);
        stream.userId = userId;

        return ResultUtil.success(await this.budgetStreamData.insert(userId, stream));
    }

    public async saveBudgetStream(userId: string, stream: BudgetStream): Promise<OperationResult<BudgetStream>> {
        const updated = await this.budgetStreamData.update(userId, stream);
        if (!updated) {
            return ResultUtil.userError('Budget stream not found or access denied');
        }
        return ResultUtil.success(updated);
    }

    public async deleteBudgetStream(userId: string, id: string): Promise<OperationResult<void>> {
        const deleted = await this.budgetStreamData.delete(userId, id);
        if (!deleted) {
            return ResultUtil.userError('Budget stream not found or access denied');
        }
        return ResultUtil.success();
    }
}
