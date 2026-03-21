import { EntityIdPrefix } from '@shared/core/enum';
import { Institution } from '@shared/finance/types';
import { DatabaseError, databasePool } from './../db-client';
import { generateEntityId } from './../../utility/id-util';

export interface IFinanceInstitutionsData {
    retrieveAll(userId: string): Promise<Institution[]>;
}

export class FinanceInstitutionsData implements IFinanceInstitutionsData {
    public async retrieveAll(userId: string): Promise<Institution[]> {
        try {
            const result = await databasePool.query(
                `SELECT 
                    i.id, 
                    i.created_at AS "createdAt",
                    i.updated_at AS "updatedAt",
                    i.profile_id as "profileId", 
                    i.name 
                FROM finance.institutions AS i
                    JOIN finance.profiles AS p ON i.profile_id = p.id
                WHERE p.user_id = $1`,
                [userId]
            );
            return result.rows;
        }
        catch (err) {
            throw new DatabaseError();
        }
    }
}