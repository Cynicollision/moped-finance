import { OperationResult } from '@shared/core/contracts';
import { FinanceEntityIdPrefix } from '@shared/finance/enum';
import { Category, CategoryGroup } from '@shared/finance/types';
import { AppLogger } from '@server-core/logger';
import { EntityIdUtil, ResultUtil } from '@server-core/utility';
import { IFinanceCategoryData } from './category-data';
import { IFinanceCategoryGroupData } from './category-groups';

export class CategoryController {
    constructor(
        private logger: AppLogger,
        private categories: IFinanceCategoryData,
        private groups: IFinanceCategoryGroupData
    ) {
    }

    public async getGroup(userId: string, groupId: string): Promise<OperationResult<CategoryGroup>> {
        const group = await this.groups.retrieveSingle(userId, groupId);
        if (!group) {
            return ResultUtil.userError('Category Group not found or access denied');
        }
        return ResultUtil.success(group);
    }

    public async getGroups(userId: string): Promise<OperationResult<CategoryGroup[]>> {
        return ResultUtil.success(await this.groups.retrieveAll(userId));
    }

    public async createGroup(userId: string, group: CategoryGroup): Promise<OperationResult<CategoryGroup>> {
        group.id = EntityIdUtil.generate(FinanceEntityIdPrefix.CategoryGroup);
        group.userId = userId;

        return ResultUtil.success(await this.groups.insert(userId, group));
    }

    public async updateGroup(userId: string, group: CategoryGroup): Promise<OperationResult<CategoryGroup>> {
        const updated = await this.groups.update(userId, group);
        if (!updated) {
            return ResultUtil.userError('Category Group not found or access denied');
        }
        return ResultUtil.success(updated);
    }

    public async deleteGroup(userId: string, groupId: string): Promise<OperationResult<void>> {
        const deleted = await this.groups.delete(userId, groupId);
        if (!deleted) {
            return ResultUtil.userError('Category Group not found or access denied');
        }
        return ResultUtil.success();
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
