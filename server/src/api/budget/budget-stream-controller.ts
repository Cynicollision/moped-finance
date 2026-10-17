import { BudgetStream } from '@shared/finance/types';
import { EntityFactory } from '@server/data';
import { IAppLogger } from '@server/logging';
import { OperationContext, OperationResult, Result } from '@server/routing';
import { IBudgetStreamData } from './budget-stream-data';
import { CreateBudgetStreamRequest, UpdateBudgetStreamRequest } from './budget-stream-schema';

export class BudgetStreamController {
    constructor(
        private logger: IAppLogger,
        private budgetStreamData: IBudgetStreamData
    ) {}

    public async getBudgetStreams(_context: OperationContext): Promise<OperationResult<BudgetStream[]>> {
        const streams = await this.budgetStreamData.retrieveAll();
        return Result.success(streams);
    }

    public async createBudgetStream(
        context: OperationContext,
        input: CreateBudgetStreamRequest
    ): Promise<OperationResult<BudgetStream>> {
        // A missing category fails the insert's foreign key, which OperationHandler reports as a 400.
        const budgetStream = EntityFactory.createBudgetStream(input);
        const created = await this.budgetStreamData.insert(budgetStream);
        return Result.successCreated(created);
    }

    public async saveBudgetStream(
        context: OperationContext,
        budgetStreamId: string,
        changes: UpdateBudgetStreamRequest
    ): Promise<OperationResult<BudgetStream>> {
        const current = await this.budgetStreamData.retrieveSingle(budgetStreamId);
        if (!current) {
            return Result.userErrorNotFound();
        }

        const updated = await this.budgetStreamData.update({ ...current, ...changes });
        if (!updated) {
            return Result.userErrorNotFound();
        }

        return Result.successUpdated(updated);
    }

    public async deleteBudgetStream(context: OperationContext, budgetStreamId: string): Promise<OperationResult<void>> {
        const deleted = await this.budgetStreamData.delete(budgetStreamId);
        if (!deleted) {
            return Result.userErrorNotFound();
        }
        return Result.successDeleted();
    }
}
