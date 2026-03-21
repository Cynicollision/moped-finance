import { EntityIdPrefix } from '@shared/core/enum';
import { Category } from '@shared/finance/types';
import { DatabaseError, databasePool } from './../db-client';
import { generateEntityId } from './../../utility/id-util';

export interface IFinanceCategoriesData {
    retrieveAll(userId: string, activeOnly: boolean): Promise<Category[]>;
}

export class FinanceCategoriesData implements IFinanceCategoriesData {

    public async retrieveAll(userId: string, activeOnly: boolean): Promise<Category[]> {
        try {
            let query = `SELECT 
                        c.id, 
                        c.created_at AS "createdAt",
                        c.updated_at AS "updatedAt",
                        c.profile_id AS "profileId",
                        c.category_class AS "class",
                        c.category_group AS "group",
                        c.icon,
                        c.name,
                        c.is_active AS "isActive"
                    FROM finance.categories AS c
                        JOIN finance.profiles AS p ON p.id = c.profile_id
                    WHERE p.user_id = $1`;

            if (activeOnly) {
                query += ' AND c.is_active = true';
            }

            const result = await databasePool.query(query, [userId]);
            return result.rows;
        }
        catch (err) {
            throw new DatabaseError();
        }
    }
}