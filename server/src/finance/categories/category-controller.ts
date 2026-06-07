import { OperationResult } from '@shared/common/contracts';
import { EntityIdPrefix } from '@shared/common/enum';
import { Category } from '@shared/finance/types';
import { AppLogger } from '@core/logger';
import { EntityIdUtil, ResultUtil } from '@core/utility';
import { IFinanceCategoriesData } from './categories-data';

export class CategoryController {
    constructor(
        private logger: AppLogger,
        private categories: IFinanceCategoriesData
    ) {
    }

    public async getCategory(userId: string, id: string): Promise<OperationResult<Category>> {
        const category = await this.categories.retrieveSingle(userId, id);
        if (!category) {
            return ResultUtil.userError('Category not found or access denied');
        }
        return ResultUtil.success(category);
    }

    public async getCategories(userId: string, activeOnly: boolean = false): Promise<OperationResult<Category[]>> {
        return ResultUtil.success(await this.categories.retrieveAll(userId, activeOnly));
    }

    public async createCategory(userId: string, category: Category): Promise<OperationResult<Category>> {
        category.id = EntityIdUtil.generate(EntityIdPrefix.FinanceCategory);
        category.userId = userId;

        return ResultUtil.success(await this.categories.insert(userId, category));
    }

    public async updateCategory(userId: string, category: Category): Promise<OperationResult<Category>> {
        const updated = await this.categories.update(userId, category);
        if (!updated) {
            return ResultUtil.userError('Category not found or access denied');
        }
        return ResultUtil.success(updated);
    }

    public async deleteCategory(userId: string, id: string): Promise<OperationResult<void>> {
        const deleted = await this.categories.delete(userId, id);
        if (!deleted) {
            return ResultUtil.userError('Category not found or access denied');
        }
        return ResultUtil.success();
    }
}
