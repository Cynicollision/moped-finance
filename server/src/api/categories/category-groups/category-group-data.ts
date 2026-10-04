import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { CategoryGroup } from '@shared/finance/types';
import { CategoryType } from '@shared/finance/enum';
import { IDatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { categoryGroupSchema } from './category-group-schema';

export interface IFinanceCategoryGroupData {
    retrieveAll(): Promise<CategoryGroup[]>;
    retrieveSingle(id: string): Promise<CategoryGroup | null>;
    insert(group: CategoryGroup): Promise<CategoryGroup>;
    update(group: CategoryGroup): Promise<CategoryGroup | null>;
    delete(id: string): Promise<boolean>;
}

function mapRowToCategoryGroup(row: typeof categoryGroupSchema.$inferSelect): CategoryGroup {
    return {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        type: row.type as CategoryType,
        name: row.name
    };
}

export class FinanceCategoryGroupData implements IFinanceCategoryGroupData {
    private readonly db: NodePgDatabase;

    constructor(dbClient: IDatabaseClient) {
        this.db = dbClient.drizzle;
    }

    public async retrieveAll(): Promise<CategoryGroup[]> {
        const rows = await this.db.select().from(categoryGroupSchema);
        return rows.map(mapRowToCategoryGroup);
    }

    public async retrieveSingle(id: string): Promise<CategoryGroup | null> {
        const rows = await this.db.select().from(categoryGroupSchema).where(eq(categoryGroupSchema.id, id));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToCategoryGroup(rows[0]);
    }

    public async delete(id: string): Promise<boolean> {
        const result = await this.db
            .delete(categoryGroupSchema)
            .where(eq(categoryGroupSchema.id, id))
            .returning({ id: categoryGroupSchema.id });

        return result.length > 0;
    }

    public async insert(group: CategoryGroup): Promise<CategoryGroup> {
        const rows = await this.db
            .insert(categoryGroupSchema)
            .values({
                id: group.id,
                type: group.type,
                name: group.name
            })
            .returning();

        return mapRowToCategoryGroup(rows[0]);
    }

    public async update(group: CategoryGroup): Promise<CategoryGroup | null> {
        const rows = await this.db
            .update(categoryGroupSchema)
            .set({
                type: group.type,
                name: group.name,
                updatedAt: DateTimeUtil.now()
            })
            .where(eq(categoryGroupSchema.id, group.id))
            .returning();

        if (rows.length === 0) {
            return null;
        }

        return mapRowToCategoryGroup(rows[0]);
    }
}
