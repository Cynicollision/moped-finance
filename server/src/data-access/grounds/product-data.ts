import { Product } from '@shared/grounds/types';
import { databasePool, DatabaseError } from './../db-client';

export interface IGroundsProductData {
    retrieveAll(userId: string): Promise<Product[]>;
}

export class GroundsProductData implements IGroundsProductData {

    async retrieveAll(userId: string): Promise<Product[]> {
        try {
            const result = await databasePool.query(
                `SELECT 
                    p.id,
                    p.user_id AS "userId",
                    p.name,
                    p.manufacturer,
                    p.care_task_type AS "careTaskType",
                    p.url
                FROM grounds.products AS p
                WHERE p.user_id = $1`,
                [userId]
            );
            return result.rows;
        }
        catch (error) {
            throw new DatabaseError('Database error retrieving products.');
        }
    }
}
