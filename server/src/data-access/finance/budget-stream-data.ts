import { EntityIdPrefix } from '@shared/core/enum';
import { BudgetStream } from '@shared/finance/types';
import { DatabaseError, databasePool } from './../db-client';
import { generateEntityId } from './../../utility/id-util';

export interface IFinanceBudgetStreamData {
    retrieveAll(userId: string): Promise<BudgetStream[]>;
    delete(userId: string, id: string): Promise<void>;
    insert(userId: string, stream: BudgetStream): Promise<BudgetStream>;
}

export class FinanceBudgetStreamData implements IFinanceBudgetStreamData {

    public async retrieveAll(userId: string): Promise<BudgetStream[]> {
        try {
            const query = `SELECT 
                    bs.id, 
                    bs.created_at AS "createdAt",
                    bs.updated_at AS "updatedAt",
                    bs.profile_id AS "profileId",
                    bs.name,
                    bs.category_id AS "categoryId",
                    bs.type,
                    bs.recurrence,
                    bs.recurrence_multiple AS "recurrenceMultiple",
                    bs.amount
                FROM finance.budget_streams AS bs
                    JOIN finance.profiles AS p ON p.id = bs.profile_id
                WHERE p.user_id = $1`;

            const result = await databasePool.query(query, [userId]);

            return result.rows.map(row => ({
                ...row,
                amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount
            }));
        }
        catch (err) {
            throw new DatabaseError();
        }
    }

    public async delete(userId: string, id: string): Promise<void> {
        try {
            await databasePool.query(
                `DELETE FROM finance.budget_streams AS bs
                    USING finance.profiles AS p
                    WHERE bs.profile_id = p.id
                        AND p.user_id = $1
                        AND bs.id = $2`,
                [userId, id]
            );
        }
        catch (err) {
            throw new DatabaseError();
        }
    }

    public async insert(userId: string, stream: BudgetStream): Promise<BudgetStream> {
        try {
            // First, get the profile_id for the user
            const profileResult = await databasePool.query(
                'SELECT id FROM finance.profiles WHERE user_id = $1',
                [userId]
            );

            if (profileResult.rows.length === 0) {
                throw new Error('Profile not found');
            }

            const profileId = profileResult.rows[0].id;
            const id = stream.id || generateEntityId(EntityIdPrefix.FinanceBudgetStream);

            const query = `
                    INSERT INTO finance.budget_streams (
                        id, profile_id, name, category_id, type, recurrence, recurrence_multiple, amount
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    ON CONFLICT (id) DO UPDATE SET
                        name = EXCLUDED.name,
                        category_id = EXCLUDED.category_id,
                        type = EXCLUDED.type,
                        recurrence = EXCLUDED.recurrence,
                        recurrence_multiple = EXCLUDED.recurrence_multiple,
                        amount = EXCLUDED.amount,
                        updated_at = CURRENT_TIMESTAMP
                    RETURNING *`;

            const params = [
                id,
                profileId,
                stream.name,
                stream.categoryId,
                stream.type,
                stream.recurrence,
                stream.recurrenceMultiple,
                stream.amount
            ];

            const result = await databasePool.query(query, params);
            const row = result.rows[0];

            return {
                id: row.id,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                profileId: row.profile_id,
                name: row.name,
                categoryId: row.category_id,
                type: row.type,
                recurrence: row.recurrence,
                recurrenceMultiple: row.recurrence_multiple,
                amount: typeof row.amount === 'string' ? parseFloat(row.amount) : row.amount
            };
        }
        catch (err) {
            console.error('Error saving budget stream:', err);
            throw new DatabaseError();
        }
    }
}