import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CategoryGroup } from '@shared/finance/types';
import { CategoryClass } from '@shared/finance/enum';
import { IDatabaseClient } from '@server-core/db-client';
import { IOwnedResourceData } from '@server-core/interfaces';
import { DateTimeUtil } from '@server-core/utility';
import { categoryGroupSchema } from './category-group-schema';

export interface IFinanceCategoryGroupData extends IOwnedResourceData<CategoryGroup> {
    retrieveAll(userId: string): Promise<CategoryGroup[]>;
    delete(userId: string, id: string): Promise<boolean>;
    insert(userId: string, group: CategoryGroup): Promise<CategoryGroup>;
    update(userId: string, group: CategoryGroup): Promise<CategoryGroup | null>;
}

function mapRowToCategoryGroup(row: typeof categoryGroupSchema.$inferSelect): CategoryGroup {
    return {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        userId: row.userId,
        class: row.class as CategoryClass,
        name: row.name,
    };
}

export class FinanceCategoryGroupData implements IFinanceCategoryGroupData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async retrieveAll(userId: string): Promise<CategoryGroup[]> {
        const rows = await this.db.select().from(categoryGroupSchema)
            .where(eq(categoryGroupSchema.userId, userId));
        return rows.map(mapRowToCategoryGroup);
    }

    public async retrieveSingle(userId: string, id: string): Promise<CategoryGroup | null> {
        const rows = await this.db.select().from(categoryGroupSchema)
            .where(and(eq(categoryGroupSchema.userId, userId), eq(categoryGroupSchema.id, id)));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToCategoryGroup(rows[0]);
    }

    public async delete(userId: string, id: string): Promise<boolean> {
        const result = await this.db.delete(categoryGroupSchema)
            .where(and(eq(categoryGroupSchema.userId, userId), eq(categoryGroupSchema.id, id)))
            .returning({ id: categoryGroupSchema.id });

        return result.length > 0;
    }

    public async insert(userId: string, group: CategoryGroup): Promise<CategoryGroup> {
        const rows = await this.db.insert(categoryGroupSchema)
            .values({
                id: group.id,
                userId: userId,
                class: group.class,
                name: group.name
            })
            .returning();

        return mapRowToCategoryGroup(rows[0]);
    }

    public async update(userId: string, group: CategoryGroup): Promise<CategoryGroup | null> {
        const rows = await this.db.update(categoryGroupSchema)
            .set({
                class: group.class,
                name: group.name,
                updatedAt: DateTimeUtil.now()
            })
            .where(and(eq(categoryGroupSchema.id, group.id!), eq(categoryGroupSchema.userId, userId)))
            .returning();

        if (rows.length === 0) {
            return null;
        }

        return mapRowToCategoryGroup(rows[0]);
    }
}
