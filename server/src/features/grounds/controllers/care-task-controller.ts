import { OperationResult } from '@shared/common/contracts';
import { EntityIdPrefix } from '@shared/common/enum';
import { CareTask } from '@shared/grounds/types';
import { AppLogger } from '@core/logger';
import { EntityIdUtil, ResultUtil } from '@core/utility';
import { IGroundsCareTaskData } from './../data/care-task-data';

export class CareTaskController {
    constructor(
        private logger: AppLogger,
        private careTasks: IGroundsCareTaskData
    ) {
    }

    public async getCareTasks(userId: string, year: string): Promise<OperationResult<CareTask[]>> {
        return ResultUtil.success(await this.careTasks.retrieveAll(userId));
    }

    public async createCareTask(userId: string, task: CareTask): Promise<OperationResult<CareTask>> {
        task.userId = userId;
        task.id = EntityIdUtil.generate(EntityIdPrefix.GroundsCareTask);
        return ResultUtil.success(await this.careTasks.insert(task));
    }

    public async saveCareTask(userId: string, task: CareTask): Promise<OperationResult<CareTask>> {
        task.userId = userId;
        const updated = await this.careTasks.update(task);
        if (!updated) {
            return ResultUtil.userError('Care task not found or access denied');
        }
        return ResultUtil.success(updated);
    }
}
