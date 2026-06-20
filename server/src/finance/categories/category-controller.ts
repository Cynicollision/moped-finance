import { OperationResult } from '@shared/core/contracts';
import { NewEntity } from '@shared/core/types';
import { Category, CategoryGroup } from '@shared/finance/types';
import { IAppLogger } from '@server-core/logger';
import { OperationContext } from '@server-core/operation-handler';
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

    public async getGroup(context: OperationContext, groupId: string): Promise<OperationResult<CategoryGroup>> {
        const group = await this.groupData.retrieveSingle(groupId);
        if (!group) {
            return Result.userErrorNotFound();
        }
        return Result.success(group);
    }

    public async getGroups(context: OperationContext): Promise<OperationResult<CategoryGroup[]>> {
        const groups = await this.groupData.retrieveAll(context.user.getId());
        return Result.success(groups);
    }

    public async createGroup(context: OperationContext, newGroup: NewEntity<CategoryGroup>): Promise<OperationResult<CategoryGroup>> {
        const group = FinanceEntityFactory.createCategoryGroup(context.user.getId(), newGroup);
        const created = await this.groupData.insert(group);
        return Result.successCreated(created);
    }

    public async updateGroup(context: OperationContext, group: CategoryGroup): Promise<OperationResult<CategoryGroup>> {
        const current = await this.groupData.retrieveSingle(group.id);
        if (!current || !context.user.canAccess(current)) {
            return Result.userErrorNotFound();
        }

        const updated = await this.groupData.update(group);
        if (!updated) {
            return Result.userErrorNotFound();
        }

        return Result.success(updated);
    }

    public async deleteGroup(context: OperationContext, groupId: string): Promise<OperationResult<void>> {
        const current = await this.groupData.retrieveSingle(groupId);
        if (!current || !context.user.canAccess(current)) {
            return Result.userErrorNotFound();
        }

        const deleted = await this.groupData.delete(groupId);
        if (!deleted) {
            return Result.userErrorNotFound();
        }

        return Result.successDeleted();
    }

    public async getCategory(context: OperationContext, categoryId: string): Promise<OperationResult<Category>> {
        const category = await this.categoryData.retrieveSingle(categoryId);
        if (!category) {
            return Result.userErrorNotFound();
        }
        return Result.success(category);
    }

    public async getCategories(context: OperationContext, activeOnly: boolean = false): Promise<OperationResult<Category[]>> {
        const categories = await this.categoryData.retrieveAll(context.user.getId(), activeOnly);
        return Result.success(categories);
    }

    public async createCategory(context: OperationContext, newCategory: NewEntity<Category>): Promise<OperationResult<Category>> {
        const category = FinanceEntityFactory.createCategory(context.user.getId(), newCategory);
        const created = await this.categoryData.insert(category);
        return Result.successCreated(created);
    }

    public async updateCategory(context: OperationContext, category: Category): Promise<OperationResult<Category>> {
        const current = await this.categoryData.retrieveSingle(category.id);
        if (!current || !context.user.canAccess(current)) {
            return Result.userErrorNotFound();
        }

        const updated = await this.categoryData.update(category);
        if (!updated) {
            return Result.userErrorNotFound();
        }
        return Result.successUpdated(updated);
    }

    public async deleteCategory(context: OperationContext, categoryId: string): Promise<OperationResult<void>> {
        const current = await this.categoryData.retrieveSingle(categoryId);
        if (!current || !context.user.canAccess(current)) {
            return Result.userErrorNotFound();
        }

        const deleted = await this.categoryData.delete(categoryId);
        if (!deleted) {
            return Result.userErrorNotFound();
        }

        return Result.successDeleted();
    }
}
