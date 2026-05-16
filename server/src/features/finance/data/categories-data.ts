import { Category } from '@shared/finance/types';
import { IOwnedResourceData, IDatabaseClient } from '@core/interfaces';

export interface IFinanceCategoriesData extends IOwnedResourceData<Category> {
    retrieveAll(userId: string, activeOnly: boolean): Promise<Category[]>;
}

export class FinanceCategoriesData implements IFinanceCategoriesData {
    constructor(private db: IDatabaseClient) {}

    public async retrieveAll(userId: string, activeOnly: boolean): Promise<Category[]> {
        let query = `SELECT 
                    c.id, 
                    c.created_at AS "createdAt",
                    c.updated_at AS "updatedAt",
                    c.user_id AS "userId",
                    c.category_class AS "class",
                    c.category_group AS "group",
                    c.icon,
                    c.name,
                    c.is_active AS "isActive"
                FROM finance.categories AS c
                WHERE c.user_id = $1`;

        if (activeOnly) {
            query += ' AND c.is_active = true';
        }

        const result = await this.db.query(query, [userId]);
        return result.rows;
    }

    public async retrieveSingle(userId: string, id: string): Promise<Category | null> {
        const query = `SELECT 
                    c.id, 
                    c.created_at AS "createdAt",
                    c.updated_at AS "updatedAt",
                    c.user_id AS "userId",
                    c.category_class AS "class",
                    c.category_group AS "group",
                    c.icon,
                    c.name,
                    c.is_active AS "isActive"
                FROM finance.categories AS c
                WHERE c.user_id = $1
                    AND c.id = $2`;

        const result = await this.db.query(query, [userId, id]);

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    }

    public async delete(userId: string, id: string): Promise<void> {
        await this.db.query(
            `DELETE FROM finance.categories AS c
                WHERE c.user_id = $1
                    AND c.id = $2`,
            [userId, id]
        );
    }

    public async insert(userId: string, category: Category): Promise<Category> {
        const query = `
                INSERT INTO finance.categories (
                    id, user_id, category_class, category_group, icon, name, is_active
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *`;

        const params = [
            category.id,
            userId,
            category.class,
            category.group,
            category.icon,
            category.name,
            category.isActive
        ];

        const result = await this.db.query(query, params);
        const row = result.rows[0];

        return {
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            userId: row.user_id,
            class: row.category_class,
            group: row.category_group,
            icon: row.icon,
            name: row.name,
            isActive: row.is_active
        };
    }

    public async update(userId: string, category: Category): Promise<Category> {
        const query = `
                UPDATE finance.categories SET
                    category_class = $1,
                    category_group = $2,
                    icon = $3,
                    name = $4,
                    is_active = $5,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $6 AND user_id = $7
                RETURNING *`;

        const params = [
            category.class,
            category.group,
            category.icon,
            category.name,
            category.isActive,
            category.id,
            userId
        ];

        const result = await this.db.query(query, params);
        const row = result.rows[0];

        return {
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            userId: row.user_id,
            class: row.category_class,
            group: row.category_group,
            icon: row.icon,
            name: row.name,
            isActive: row.is_active
        };
    }
}