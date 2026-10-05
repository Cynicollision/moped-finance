import { eq, and, SQL } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CategoryNecessity } from '@shared/finance/enum';
import { Category } from '@shared/finance/types';
import { IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { categorySchema } from './category-schema';

export interface IFinanceCategoryData {
    retrieveAll(activeOnly?: boolean): Promise<Category[]>;
    retrieveSingle(id: string): Promise<Category | null>;
    insert(category: Category): Promise<Category>;
    update(category: Category): Promise<Category | null>;
    delete(id: string): Promise<boolean>;
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

    public async delete(id: string): Promise<boolean> {
        const result = await this.db
            .delete(categorySchema)
            .where(eq(categorySchema.id, id))
            .returning({ id: categorySchema.id });

        return result.length > 0;
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
