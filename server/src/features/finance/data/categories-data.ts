import { eq, and } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Category } from '@shared/finance/types';
import { CategoryClass } from '@shared/finance/enum';
import { IOwnedResourceData } from '@core/interfaces';
import { DateTimeUtil } from '@core/utility';
import { categorySchema } from './../schema/category-schema';

export interface IFinanceCategoriesData extends IOwnedResourceData<Category> {
    retrieveAll(userId: string, activeOnly: boolean): Promise<Category[]>;
    delete(userId: string, id: string): Promise<boolean>;
    insert(userId: string, category: Category): Promise<Category>;
    update(userId: string, category: Category): Promise<Category | null>;
}

function mapRowToCategory(row: typeof categorySchema.$inferSelect): Category {
    return {
        id: row.id,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        userId: row.userId,
        class: row.class as CategoryClass,
        group: row.group,
        icon: row.icon,
        name: row.name,
        isActive: row.isActive,
    };
}

export class FinanceCategoriesData implements IFinanceCategoriesData {
    constructor(private db: NodePgDatabase) {}

    public async retrieveAll(userId: string, activeOnly: boolean): Promise<Category[]> {
        const conditions = [
            eq(categorySchema.userId, userId)
        ];

        if (activeOnly) {
            conditions.push(eq(categorySchema.isActive, true));
        }

        const rows = await this.db.select().from(categorySchema).where(and(...conditions));
        return rows.map(mapRowToCategory);
    }

    public async retrieveSingle(userId: string, id: string): Promise<Category | null> {
        const rows = await this.db.select().from(categorySchema)
            .where(and(eq(categorySchema.userId, userId), eq(categorySchema.id, id)));

        if (rows.length === 0) {
            return null;
        }

        return mapRowToCategory(rows[0]);
    }

    public async delete(userId: string, id: string): Promise<boolean> {
        const result = await this.db.delete(categorySchema)
            .where(and(eq(categorySchema.userId, userId), eq(categorySchema.id, id)));

        return (result.rowCount ?? 0) > 0;
    }

    public async insert(userId: string, category: Category): Promise<Category> {
        const rows = await this.db.insert(categorySchema)
            .values({
                id: category.id,
                userId: userId,
                class: category.class,
                group: category.group,
                icon: category.icon,
                name: category.name,
                isActive: category.isActive
            })
            .returning();

        return mapRowToCategory(rows[0]);
    }

    public async update(userId: string, category: Category): Promise<Category | null> {
        const rows = await this.db.update(categorySchema)
            .set({
                class: category.class,
                group: category.group,
                icon: category.icon,
                name: category.name,
                isActive: category.isActive,
                updatedAt: DateTimeUtil.now()
            })
            .where(and(eq(categorySchema.id, category.id!), eq(categorySchema.userId, userId)))
            .returning();

        if (rows.length === 0) {
            return null;
        }

        return mapRowToCategory(rows[0]);
    }
}