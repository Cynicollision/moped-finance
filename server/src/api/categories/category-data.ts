import { eq, and, count, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CategoryNecessity } from '@shared/finance/enum';
import { Category, CategoryGroup, CategoryUsage } from '@shared/finance/types';
import { IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { budgetStreamSchema } from './../budget/budget-stream-schema';
import { transactionSchema } from './../transactions/transaction-schema';
import { categoryGroupSchema } from './category-groups/category-group-schema';
import { categorySchema } from './category-schema';

const bulkInsertChunkSize = 1000;

export interface IFinanceCategoryData {
    retrieveAll(activeOnly?: boolean): Promise<Category[]>;
    retrieveSingle(id: string): Promise<Category | null>;
    retrieveUsage(id: string): Promise<CategoryUsage>;
    insert(category: Category): Promise<Category>;
    /** Inserts new groups and the categories in them, all together or none (CAT-7.2). */
    insertBulk(categories: Category[], groups: CategoryGroup[]): Promise<void>;
    update(category: Category): Promise<Category | null>;
    /** Moves the category's transactions to `moveToId` (Uncategorized when null) and deletes it, together or not at all. */
    delete(id: string, moveToId?: string | null): Promise<boolean>;
}

function mapRowToCategory(row: typeof categorySchema.$inferSelect): Category {
    return {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        groupId: row.groupId,
        icon: row.icon ?? '',
        name: row.name,
        isActive: row.isActive,
        necessity: row.necessity as CategoryNecessity | null
    };
}

export class FinanceCategoryData implements IFinanceCategoryData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async retrieveAll(activeOnly?: boolean): Promise<Category[]> {
        const conditions: SQL[] = [];

        if (activeOnly) {
            conditions.push(eq(categorySchema.isActive, true));
        }

        const rows = await this.db
            .select()
            .from(categorySchema)
            .where(and(...conditions));
        return rows.map(mapRowToCategory);
    }

    public async retrieveSingle(id: string): Promise<Category | null> {
        const rows = await this.db.select().from(categorySchema).where(eq(categorySchema.id, id));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToCategory(rows[0]);
    }

    public async retrieveUsage(id: string): Promise<CategoryUsage> {
        const [transactions] = await this.db
            .select({ count: count() })
            .from(transactionSchema)
            .where(eq(transactionSchema.categoryId, id));
        const [streams] = await this.db
            .select({ count: count() })
            .from(budgetStreamSchema)
            .where(eq(budgetStreamSchema.categoryId, id));

        return { transactionCount: transactions.count, budgetStreamCount: streams.count };
    }

    public async delete(id: string, moveToId: string | null = null): Promise<boolean> {
        // Without a target, the transactions' foreign key (ON DELETE SET NULL) leaves them Uncategorized. A budget stream
        // fails the delete's foreign key, which rolls the move back too (CAT-4.5).
        return this.db.transaction(async tx => {
            if (moveToId) {
                await tx
                    .update(transactionSchema)
                    .set({ categoryId: moveToId, updatedAt: DateTimeUtil.now() })
                    .where(eq(transactionSchema.categoryId, id));
            }

            const result = await tx
                .delete(categorySchema)
                .where(eq(categorySchema.id, id))
                .returning({ id: categorySchema.id });

            return result.length > 0;
        });
    }

    public async insert(category: Category): Promise<Category> {
        const rows = await this.db
            .insert(categorySchema)
            .values({
                id: category.id,
                groupId: category.groupId,
                icon: category.icon || null,
                name: category.name,
                isActive: category.isActive,
                necessity: category.necessity
            })
            .returning();

        return mapRowToCategory(rows[0]);
    }

    public async insertBulk(categories: Category[], groups: CategoryGroup[]): Promise<void> {
        // One transaction, so a failure in any chunk rolls back the rest. Groups go first, for the categories' foreign key.
        await this.db.transaction(async tx => {
            for (let i = 0; i < groups.length; i += bulkInsertChunkSize) {
                const chunk = groups.slice(i, i + bulkInsertChunkSize);
                await tx.insert(categoryGroupSchema).values(chunk.map(g => ({ id: g.id, type: g.type, name: g.name })));
            }
            for (let i = 0; i < categories.length; i += bulkInsertChunkSize) {
                const chunk = categories.slice(i, i + bulkInsertChunkSize);
                await tx.insert(categorySchema).values(
                    chunk.map(c => ({
                        id: c.id,
                        groupId: c.groupId,
                        icon: c.icon || null,
                        name: c.name,
                        isActive: c.isActive,
                        necessity: c.necessity
                    }))
                );
            }
        });
    }

    public async update(category: Category): Promise<Category | null> {
        const rows = await this.db
            .update(categorySchema)
            .set({
                groupId: category.groupId,
                icon: category.icon || null,
                name: category.name,
                isActive: category.isActive,
                necessity: category.necessity,
                updatedAt: DateTimeUtil.now()
            })
            .where(eq(categorySchema.id, category.id!))
            .returning();

        if (rows.length === 0) {
            return null;
        }

        return mapRowToCategory(rows[0]);
    }
}
