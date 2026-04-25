import { Institution } from '@shared/finance/types';
import { IOwnedResourceData } from './../../../core/base-resource-data';
import { databasePool } from './../../../core/db-client';

export interface IFinanceInstitutionsData extends IOwnedResourceData<Institution> {
    retrieveAll(userId: string): Promise<Institution[]>;
}

export class FinanceInstitutionsData implements IFinanceInstitutionsData {
    public async retrieveAll(userId: string): Promise<Institution[]> {
        const result = await databasePool.query(
            `SELECT 
                i.id, 
                i.created_at AS "createdAt",
                i.updated_at AS "updatedAt",
                i.user_id as "userId", 
                i.name 
            FROM finance.institutions AS i
            WHERE i.user_id = $1`,
            [userId]
        );
        return result.rows;
    }

    public async retrieveSingle(userId: string, id: string): Promise<Institution | null> {
        const query = `
            SELECT 
                i.id, 
                i.created_at AS "createdAt",
                i.updated_at AS "updatedAt",
                i.user_id AS "userId", 
                i.name 
            FROM finance.institutions AS i
            WHERE i.user_id = $1
                AND i.id = $2`;

        const result = await databasePool.query(query, [userId, id]);

        if (result.rows.length === 0) {
            return null;
        }

        const row = result.rows[0];
        return {
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            userId: row.user_id,
            name: row.name
        };
    }

    public async delete(userId: string, id: string): Promise<void> {
        await databasePool.query(
            `DELETE FROM finance.institutions AS i
            WHERE i.user_id = $1
                AND i.id = $2`,
            [userId, id]
        );
    }

    public async insert(userId: string, institution: Institution): Promise<Institution> {
        const query = `
            INSERT INTO finance.institutions (
                id, user_id, name
            )
            VALUES ($1, $2, $3)
            RETURNING *`;

        const params = [
            institution.id,
            userId,
            institution.name
        ];

        const result = await databasePool.query(query, params);
        const row = result.rows[0];

        return {
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            userId: row.user_id,
            name: row.name
        };
    }

    public async update(userId: string, institution: Institution): Promise<Institution> {
        const query = `
            UPDATE finance.institutions SET
                name = $1,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $2 AND user_id = $3
            RETURNING *`;

        const params = [
            institution.name,
            institution.id,
            userId
        ];

        const result = await databasePool.query(query, params);
        const row = result.rows[0];

        return {
            id: row.id,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            userId: row.user_id,
            name: row.name
        };
    }
}