import { Category } from '@shared/finance/types';
import { databasePool } from './../db-client';

export interface IFinanceCategoriesData {
    retrieveAll(userId: string, activeOnly: boolean): Promise<Category[]>;
}

export class FinanceCategoriesData implements IFinanceCategoriesData {

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

        const result = await databasePool.query(query, [userId]);
        return result.rows;
    }
}