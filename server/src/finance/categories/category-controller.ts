import { OperationResult } from '@shared/core/contracts';
import { FinanceEntityIdPrefix } from '@shared/finance/enum';
import { Category } from '@shared/finance/types';
import { AppLogger } from '@server-core/logger';
import { EntityIdUtil, ResultUtil } from '@server-core/utility';
import { IFinanceCategoriesData } from './category-data';

export class CategoryController {
    private readonly logger: AppLogger;
    private readonly categories: IFinanceCategoriesData;

    constructor(logger: AppLogger, categories: IFinanceCategoriesData) {
        this.logger = logger;
        this.categories = categories;
    }

    public async getCategory(userId: string, categoryId: string): Promise<OperationResult<Category>> {
        const category = await this.categories.retrieveSingle(userId, categoryId);
        if (!category) {
            return ResultUtil.userError('Category not found or access denied');
        }
        return ResultUtil.success(category);
    }

    public async getCategories(userId: string, activeOnly: boolean = false): Promise<OperationResult<Category[]>> {
        return ResultUtil.success(await this.categories.retrieveAll(userId, activeOnly));
    }

    public async createCategory(userId: string, category: Category): Promise<OperationResult<Category>> {
        category.id = EntityIdUtil.generate(FinanceEntityIdPrefix.Category);
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

    public async deleteCategory(userId: string, categoryId: string): Promise<OperationResult<void>> {
        const deleted = await this.categories.delete(userId, categoryId);
        if (!deleted) {
            return ResultUtil.userError('Category not found or access denied');
        }
        return ResultUtil.success();
    }
}
