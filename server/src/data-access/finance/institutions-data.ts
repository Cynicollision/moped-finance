import { Institution } from '@shared/finance/types';
import { databasePool } from './../db-client';

export interface IFinanceInstitutionsData {
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
}