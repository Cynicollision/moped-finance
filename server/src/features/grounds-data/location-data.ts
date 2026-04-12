import { Location } from '@shared/grounds/types/location';
import { databasePool } from './../../core/db-client';

export interface IGroundsLocationData {
    retrieveAll(userId: string): Promise<Location[]>;
}

export class GroundsLocationData implements IGroundsLocationData {

    async retrieveAll(userId: string): Promise<Location[]> {
        const result = await databasePool.query(
            `SELECT 
                l.id,
                l.user_id AS "userId",
                l.name,
                l.type
            FROM grounds.locations AS l
            WHERE l.user_id = $1`,
            [userId]
        );
        return result.rows;
    }
}
