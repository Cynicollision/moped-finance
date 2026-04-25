import { Product } from '@shared/grounds/types';
import { databasePool } from './../../core/db-client';

export interface IGroundsProductData {
    retrieveAll(userId: string): Promise<Product[]>;
    retrieveSingle(userId: string, productId: string): Promise<Product | null>;
    insert(product: Product): Promise<Product>;
    update(product: Product): Promise<Product>;
    delete(userId: string, productId: string): Promise<void>;
}

export class GroundsProductData implements IGroundsProductData {

    async retrieveAll(userId: string): Promise<Product[]> {
        const result = await databasePool.query(
            `SELECT 
                p.id,
                p.user_id AS "userId",
                p.name,
                p.manufacturer,
                p.care_task_type AS "careTaskType",
                p.purpose_description AS "purposeDescription",
                p.url
            FROM grounds.products AS p
            WHERE p.user_id = $1`,
            [userId]
        );
        return result.rows;
    }

    async retrieveSingle(userId: string, productId: string): Promise<Product | null> {
        const result = await databasePool.query(
            `SELECT 
                p.id,
                p.user_id AS "userId",
                p.name,
                p.manufacturer,
                p.care_task_type AS "careTaskType",
                p.purpose_description AS "purposeDescription",
                p.url
            FROM grounds.products AS p
            WHERE p.id = $1
            AND p.user_id = $2`,
            [productId, userId]
        );
        return result.rows[0] || null;
    }

    async insert(product: Product): Promise<Product> {
        const result = await databasePool.query(
            `INSERT INTO grounds.products (
                id,
                user_id,
                name,
                manufacturer,
                care_task_type,
                purpose_description,
                url
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING *`,
            [
                product.id,
                product.userId,
                product.name,
                product.manufacturer,
                product.careTaskType,
                product.purposeDescription,
                product.url
            ]
        );
        return result.rows[0];
    }

    async update(product: Product): Promise<Product> {
        const result = await databasePool.query(
            `UPDATE grounds.products
            SET
                name = $2,
                manufacturer = $3,
                care_task_type = $4,
                purpose_description = $5,
                url = $6
            WHERE id = $1
            RETURNING *`,
            [
                product.id,
                product.name,
                product.manufacturer,
                product.careTaskType,
                product.purposeDescription,
                product.url
            ]
        );
        return result.rows[0];
    }

    async delete(userId: string, productId: string): Promise<void> {
        await databasePool.query(
            `DELETE FROM grounds.products
            WHERE id = $1
            AND user_id = $2`,
            [productId, userId]
        );
    }
}
