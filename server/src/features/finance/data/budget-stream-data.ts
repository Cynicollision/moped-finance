import { BudgetStream } from '@shared/finance/types';
import { IOwnedResourceData } from './../../../core/base-resource-data';
import { databasePool } from './../../../core/db-client';

export interface IFinanceBudgetStreamData extends IOwnedResourceData<BudgetStream> {
    retrieveAll(userId: string): Promise<BudgetStream[]>;
    retrieveSingle(userId: string, id: string): Promise<BudgetStream | null>;
    delete(userId: string, id: string): Promise<void>;
    insert(userId: string, stream: BudgetStream): Promise<BudgetStream>;
    update(userId: string, stream: BudgetStream): Promise<BudgetStream>;
}

export class FinanceBudgetStreamData implements IFinanceBudgetStreamData {

    public async retrieveAll(userId: string): Promise<BudgetStream[]> {
        const query = `SELECT 
                            bs.id, 
                            bs.created_at AS "createdAt",
                            bs.updated_at AS "updatedAt",
                            bs.user_id AS "userId",
                            bs.name,
                            bs.category_id AS "categoryId",
                            bs.type,
                            bs.recurrence,
                            bs.amount
                        FROM finance.budget_streams AS bs
                        WHERE bs.user_id = $1`;

        const result = await databasePool.query(query, [userId]);

        return result.rows.map(row => ({
            ...row,
            amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount
        }));
    }

    public async retrieveSingle(userId: string, id: string): Promise<BudgetStream | null> {
        const query = `SELECT 
                            bs.id, 
                            bs.created_at AS "createdAt",
                            bs.updated_at AS "updatedAt",
                            bs.user_id AS "userId",
                            bs.name,
                            bs.category_id AS "categoryId",
                            bs.type,
                            bs.recurrence,
                            bs.amount
                        FROM finance.budget_streams AS bs
                        WHERE bs.user_id = $1
                            AND bs.id = $2`;

        const result = await databasePool.query(query, [userId, id]);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            ...row,
            amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount
        };
    }

    public async delete(userId: string, id: string): Promise<void> {
        await databasePool.query(
            `DELETE FROM finance.budget_streams AS bs
                WHERE bs.user_id = $1
                    AND bs.id = $2`,
            [userId, id]
        );
    }

    public async insert(userId: string, stream: BudgetStream): Promise<BudgetStream> {
        const query = `
                INSERT INTO finance.budget_streams (
                    id, user_id, name, category_id, type, recurrence, amount
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                RETURNING *`;

        const params = [
            stream.id,
            userId,
            stream.name,
            stream.categoryId,
            stream.type,
            stream.recurrence,
            stream.amount
        ];

        const result = await databasePool.query(query, params);
        const row = result.rows[0];

        return {
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            userId: row.user_id,
            name: row.name,
            categoryId: row.category_id,
            type: row.type,
            recurrence: row.recurrence,
            amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount
        };
    }

    public async update(userId: string, stream: BudgetStream): Promise<BudgetStream> {
        const query = `
                UPDATE finance.budget_streams SET
                    name = $1,
                    category_id = $2,
                    type = $3,
                    recurrence = $4,
                    amount = $5,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = $6 AND user_id = $7
                RETURNING *`;

        const params = [
            stream.name,
            stream.categoryId,
            stream.type,
            stream.recurrence,
            stream.amount,
            stream.id,
            userId
        ];

        const result = await databasePool.query(query, params);
        const row = result.rows[0];

        return {
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            userId: row.user_id,
            name: row.name,
            categoryId: row.category_id,
            type: row.type,
            recurrence: row.recurrence,
            amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount
        };
    }
}