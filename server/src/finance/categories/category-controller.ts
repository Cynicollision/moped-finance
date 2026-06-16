import { OperationResult } from '@shared/core/contracts';
import { NewEntity } from '@shared/core/types';
import { Category, CategoryGroup } from '@shared/finance/types';
import { ResourceAccess } from '@server-core/auth';
import { IAppLogger } from '@server-core/logger';
import { Result } from '@server-core/utility';
import { FinanceEntityFactory } from './../common';
import { IFinanceCategoryData } from './category-data';
import { IFinanceCategoryGroupData } from './category-groups';

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
            return Result.userErrorNotFound();
        }
        return Result.success(group);
    }

    public async getGroups(userId: string): Promise<OperationResult<CategoryGroup[]>> {
        const groups = await this.groupData.retrieveAll(userId);
        return Result.success(groups);
    }

    public async createGroup(userId: string, newGroup: NewEntity<CategoryGroup>): Promise<OperationResult<CategoryGroup>> {
        const group = FinanceEntityFactory.createCategoryGroup(userId, newGroup);
        const created = await this.groupData.insert(group);
        return Result.successCreated(created);
    }

    public async updateGroup(userId: string, group: CategoryGroup): Promise<OperationResult<CategoryGroup>> {
        const current = await this.groupData.retrieveSingle(group.id);
        if (!current || !ResourceAccess.validate(userId, current)) {
            return Result.userErrorNotFound();
        }

        const updated = await this.groupData.update(group);
        if (!updated) {
            return Result.userErrorNotFound();
        }

        return Result.success(updated);
    }

    public async deleteGroup(userId: string, groupId: string): Promise<OperationResult<void>> {
        const current = await this.groupData.retrieveSingle(groupId);
        if (!current || !ResourceAccess.validate(userId, current)) {
            return Result.userErrorNotFound();
        }

        const deleted = await this.groupData.delete(groupId);
        if (!deleted) {
            return Result.userErrorNotFound();
        }

        return Result.successDeleted();
    }

    public async getCategory(userId: string, categoryId: string): Promise<OperationResult<Category>> {
        const category = await this.categoryData.retrieveSingle(categoryId);
        if (!category) {
            return Result.userErrorNotFound();
        }
        return Result.success(category);
    }

    public async getCategories(userId: string, activeOnly: boolean = false): Promise<OperationResult<Category[]>> {
        const categories = await this.categoryData.retrieveAll(userId, activeOnly);
        return Result.success(categories);
    }

    public async createCategory(userId: string, newCategory: NewEntity<Category>): Promise<OperationResult<Category>> {
        const category = FinanceEntityFactory.createCategory(userId, newCategory);
        const created = await this.categoryData.insert(category);
        return Result.successCreated(created);
    }

    public async updateCategory(userId: string, category: Category): Promise<OperationResult<Category>> {
        const current = await this.categoryData.retrieveSingle(category.id);
        if (!current || !ResourceAccess.validate(userId, current)) {
            return Result.userErrorNotFound();
        }

        const updated = await this.categoryData.update(category);
        if (!updated) {
            return Result.userErrorNotFound();
        }
        return Result.successUpdated(updated);
    }

    public async deleteCategory(userId: string, categoryId: string): Promise<OperationResult<void>> {
        const current = await this.categoryData.retrieveSingle(categoryId);
        if (!current || !ResourceAccess.validate(userId, current)) {
            return Result.userErrorNotFound();
        }

        const deleted = await this.categoryData.delete(categoryId);
        if (!deleted) {
            return Result.userErrorNotFound();
        }

        return Result.successDeleted();
    }
}
