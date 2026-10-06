import { CategoryImportResult } from '@shared/finance/contracts';
import { CategoryType } from '@shared/finance/enum';
import { Category, CategoryGroup, CategoryUsage } from '@shared/finance/types';
import { Uncategorized } from '@shared/finance/util';
import { FinanceEntityFactory } from '@server/data';
import { IAppLogger } from '@server/logging';
import { OperationContext, OperationResult, Result } from '@server/routing';
import { DateTimeUtil } from '@server/utility';
import { CategoryCsv, CategoryExport } from './category-csv';
import { IFinanceCategoryData } from './category-data';
import { CreateCategoryRequest, UpdateCategoryRequest } from './category-schema';
import { CreateCategoryGroupRequest, IFinanceCategoryGroupData, UpdateCategoryGroupRequest } from './category-groups';

const necessityRefusal = 'Only expense categories can have a necessity.';

// Uncategorized is the state of a transaction with no category, so no category can take its name (CAT-5.3).
const reservedNameRefusal = 'Uncategorized is reserved for transactions without a category.';

export class CategoryController {
    constructor(
        private logger: IAppLogger,
        private categoryData: IFinanceCategoryData,
        private groupData: IFinanceCategoryGroupData
    ) {}

    public async getGroup(context: OperationContext, groupId: string): Promise<OperationResult<CategoryGroup>> {
        const group = await this.groupData.retrieveSingle(groupId);
        if (!group) {
            return Result.userErrorNotFound();
        }
        return Result.success(group);
    }

    public async getGroups(_context: OperationContext): Promise<OperationResult<CategoryGroup[]>> {
        const groups = await this.groupData.retrieveAll();
        return Result.success(groups);
    }

    public async createGroup(
        context: OperationContext,
        input: CreateCategoryGroupRequest
    ): Promise<OperationResult<CategoryGroup>> {
        const group = FinanceEntityFactory.createCategoryGroup(input);
        const created = await this.groupData.insert(group);
        return Result.successCreated(created);
    }

    public async updateGroup(
        context: OperationContext,
        groupId: string,
        changes: UpdateCategoryGroupRequest
    ): Promise<OperationResult<CategoryGroup>> {
        const current = await this.groupData.retrieveSingle(groupId);
        if (!current) {
            return Result.userErrorNotFound();
        }

        // A group's type decides how its categories count, so it only changes while the group is empty (CAT-1.14).
        if (changes.type !== undefined && changes.type !== current.type) {
            const categories = await this.categoryData.retrieveAll();
            if (categories.some(category => category.groupId === groupId)) {
                return Result.userError("A category group's type can't be changed while it has categories.");
            }
        }

        const updated = await this.groupData.update({ ...current, ...changes });
        if (!updated) {
            return Result.userErrorNotFound();
        }

        return Result.successUpdated(updated);
    }

    public async deleteGroup(context: OperationContext, groupId: string): Promise<OperationResult<void>> {
        // A group that still has categories fails the delete's foreign key (ON DELETE RESTRICT),
        // which OperationHandler reports as a 400.
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

    public async getCategoryUsage(
        context: OperationContext,
        categoryId: string
    ): Promise<OperationResult<CategoryUsage>> {
        const category = await this.categoryData.retrieveSingle(categoryId);
        if (!category) {
            return Result.userErrorNotFound();
        }
        return Result.success(await this.categoryData.retrieveUsage(categoryId));
    }

    public async getCategories(context: OperationContext, activeOnly = false): Promise<OperationResult<Category[]>> {
        const categories = await this.categoryData.retrieveAll(activeOnly);
        return Result.success(categories);
    }

    public async createCategory(
        context: OperationContext,
        input: CreateCategoryRequest
    ): Promise<OperationResult<Category>> {
        if (Uncategorized.isName(input.name)) {
            return Result.userError(reservedNameRefusal);
        }

        const necessity = input.necessity ?? null;
        if (necessity && !(await this.isExpenseGroup(input.groupId))) {
            return Result.userError(necessityRefusal);
        }

        // A missing group fails the insert's foreign key, which OperationHandler reports as a 400.
        const category = FinanceEntityFactory.createCategory({
            ...input,
            isActive: input.isActive ?? true,
            necessity
        });

        const created = await this.categoryData.insert(category);
        return Result.successCreated(created);
    }

    public async updateCategory(
        context: OperationContext,
        categoryId: string,
        changes: UpdateCategoryRequest
    ): Promise<OperationResult<Category>> {
        const current = await this.categoryData.retrieveSingle(categoryId);
        if (!current) {
            return Result.userErrorNotFound();
        }

        // A category from before CAT-5 may already be called Uncategorized; it can keep its name, but none can take it.
        if (changes.name !== undefined && Uncategorized.isName(changes.name) && !Uncategorized.isName(current.name)) {
            return Result.userError(reservedNameRefusal);
        }

        // A new necessity for a category outside Expense is refused. The one it had is cleared when it moves out, even if
        // the request sends it back unchanged (CAT-1.17).
        const merged = { ...current, ...changes };
        if (merged.necessity && !(await this.isExpenseGroup(merged.groupId))) {
            if (changes.necessity && changes.necessity !== current.necessity) {
                return Result.userError(necessityRefusal);
            }
            merged.necessity = null;
        }

        const updated = await this.categoryData.update({ ...merged, necessity: merged.necessity ?? null });
        if (!updated) {
            return Result.userErrorNotFound();
        }

        return Result.successUpdated(updated);
    }

    // Only Expense categories can have a necessity (CAT-3.4). A group that doesn't exist counts as Expense here, so the
    // write goes ahead and its foreign key reports the missing group.
    private async isExpenseGroup(groupId: string): Promise<boolean> {
        const group = await this.groupData.retrieveSingle(groupId);
        return !group || group.type === CategoryType.Expense;
    }

    /**
     * Deletes a category, moving its transactions to `moveToId`, or leaving them Uncategorized without one (CAT-4.4). A
     * target that doesn't exist fails the move's foreign key, and a budget stream fails the delete's (CAT-4.5); either
     * is a 400 and changes nothing.
     */
    public async deleteCategory(
        context: OperationContext,
        categoryId: string,
        moveToId?: string
    ): Promise<OperationResult<void>> {
        if (moveToId === categoryId) {
            return Result.userError("A category's transactions can't be moved to the category being deleted.");
        }

        const deleted = await this.categoryData.delete(categoryId, moveToId);
        if (!deleted) {
            return Result.userErrorNotFound();
        }

        return Result.successDeleted();
    }

    /** Writes every category with its group's name and type (CAT-7.1). Groups with no categories aren't included. */
    public async exportCategories(_context: OperationContext): Promise<OperationResult<string>> {
        const [groups, categories] = await Promise.all([this.groupData.retrieveAll(), this.categoryData.retrieveAll()]);
        const groupsById = new Map(groups.map(g => [g.id, g]));

        const rows = categories.map((category): CategoryExport => {
            const group = groupsById.get(category.groupId)!;
            return {
                type: group.type,
                groupName: group.name,
                name: category.name,
                icon: category.icon,
                necessity: category.necessity,
                isActive: category.isActive
            };
        });

        const fileName = `Categories_${DateTimeUtil.nowToISOSafeFilename()}.csv`;
        return Result.successFile('text/csv', fileName, CategoryCsv.write(rows));
    }

    /**
     * Adds the file's new categories, and the groups they need, skipping names that already exist (CAT-7.2 to CAT-7.5).
     * All or nothing: a file with any bad row saves nothing.
     */
    public async importCategories(
        _context: OperationContext,
        file: Buffer | undefined,
        dryRun: boolean
    ): Promise<OperationResult<CategoryImportResult>> {
        const [groups, categories] = await Promise.all([this.groupData.retrieveAll(), this.categoryData.retrieveAll()]);

        const csv = CategoryCsv.read(file, groups, categories);
        if (!csv.success) {
            return Result.userError(csv.message);
        }

        const isValidToImport = csv.failedRowMessages.length === 0;
        const report = {
            createdCount: csv.categories.length,
            newGroups: csv.groups.map(g => ({ name: g.name, type: g.type })),
            skippedNames: csv.skippedNames,
            failedRowMessages: csv.failedRowMessages,
            isValidToImport
        };

        // The dry run reports the rows so the user can fix the file; a real import of a bad file (which the client
        // doesn't send) is a 400.
        if (!isValidToImport) {
            const rowCount = csv.categories.length + csv.skippedNames.length + csv.failedRowMessages.length;
            const summary = `Found errors in ${csv.failedRowMessages.length} of ${rowCount} rows.`;
            const result: CategoryImportResult = { ...report, createdCount: 0, newGroups: [], resultMessage: summary };
            return dryRun
                ? Result.success(result)
                : Result.userError(`Nothing was imported. ${summary}`, 'INVALID_IMPORT', result);
        }

        if (dryRun) {
            return Result.success({ ...report, resultMessage: `Ready to import ${csv.categories.length} categories.` });
        }

        await this.categoryData.insertBulk(csv.categories, csv.groups);
        return Result.successCreated({ ...report, resultMessage: `Imported ${csv.categories.length} categories.` });
    }
}
