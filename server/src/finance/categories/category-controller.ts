import { OperationResult } from '@shared/core/contracts';
import { NewEntity } from '@shared/core/types';
import { Category, CategoryGroup } from '@shared/finance/types';
import { IAppLogger } from '@server-core/logger';
import { Result } from '@server-core/utility';
import { FinanceEntityFactory } from './../common';
import { IFinanceCategoryData } from './category-data';
import { IFinanceCategoryGroupData } from './category-groups';

// TODO: resource ownership logic
export class CategoryController {
    constructor(
        private logger: IAppLogger,
        private categoryData: IFinanceCategoryData,
        private groupData: IFinanceCategoryGroupData
    ) {
    }

    public async getGroup(userId: string, groupId: string): Promise<OperationResult<CategoryGroup>> {
        const group = await this.groupData.retrieveSingle(groupId);
        if (!group) {
            // TODO: userErrorNotFound
            return Result.userError('Category Group not found or access denied');
        }
        return Result.success(group);
    }

    public async getGroups(userId: string): Promise<OperationResult<CategoryGroup[]>> {
        return Result.success(await this.groupData.retrieveAll(userId));
    }

    public async createGroup(userId: string, newGroup: NewEntity<CategoryGroup>): Promise<OperationResult<CategoryGroup>> {
        const group = FinanceEntityFactory.createCategoryGroup(userId, newGroup);
        return Result.success(await this.groupData.insert(group));
    }

    public async updateGroup(userId: string, group: CategoryGroup): Promise<OperationResult<CategoryGroup>> {
        const updated = await this.groupData.update(group);
        if (!updated) {
            return Result.userError('Category Group not found or access denied');
        }
        return Result.success(updated);
    }

    public async deleteGroup(userId: string, groupId: string): Promise<OperationResult<void>> {
        const deleted = await this.groupData.delete(groupId);
        if (!deleted) {
            return Result.userError('Category Group not found or access denied');
        }
        return Result.success();
    }

    public async getCategory(userId: string, categoryId: string): Promise<OperationResult<Category>> {
        const category = await this.categoryData.retrieveSingle(categoryId);
        if (!category) {
            return Result.userError('Category not found or access denied');
        }
        return Result.success(category);
    }

    public async getCategories(userId: string, activeOnly: boolean = false): Promise<OperationResult<Category[]>> {
        return Result.success(await this.categoryData.retrieveAll(userId, activeOnly));
    }

    public async createCategory(userId: string, newCategory: NewEntity<Category>): Promise<OperationResult<Category>> {
        const category = FinanceEntityFactory.createCategory(userId, newCategory);
        return Result.success(await this.categoryData.insert(category));
    }

    public async updateCategory(userId: string, category: Category): Promise<OperationResult<Category>> {
        const updated = await this.categoryData.update(category);
        if (!updated) {
            return Result.userError('Category not found or access denied');
        }
        return Result.success(updated);
    }

    public async deleteCategory(userId: string, categoryId: string): Promise<OperationResult<void>> {
        const deleted = await this.categoryData.delete(categoryId);
        if (!deleted) {
            return Result.userError('Category not found or access denied');
        }
        return Result.success();
    }
}
