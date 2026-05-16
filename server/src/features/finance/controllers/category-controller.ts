import { OperationResult } from '@shared/common/contracts';
import { Category } from '@shared/finance/types';
import { AppLogger } from '@core/logger';
import { ResultUtil } from '@core/utility';
import { IFinanceCategoriesData } from './../data/categories-data';

export class CategoryController {
    constructor(
        private logger: AppLogger,
        private categories: IFinanceCategoriesData
    ) {
    }

    public async getCategories(userId: string, activeOnly: boolean = false): Promise<OperationResult<Category[]>> {
        return ResultUtil.success(await this.categories.retrieveAll(userId, activeOnly));
    }
}
