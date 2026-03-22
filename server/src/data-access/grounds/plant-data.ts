import { Plant } from '@shared/grounds/types/plant';
import { databasePool, DatabaseError } from './../db-client';

export interface IGroundsPlantData {
    retrieveAll(userId: string): Promise<Plant[]>;
}

export class GroundsPlantData implements IGroundsPlantData {

    async retrieveAll(userId: string): Promise<Plant[]> {
        try {
            const result = await databasePool.query(
                `SELECT
                    p.id, 
                    p.user_id,
                    p.variety_id,
                    p.location_id,
                    p.planted_date
                FROM grounds.plants AS p
                WHERE p.user_id = $1`,
                [userId]
            );
            return result.rows;
        }
        catch (error) {
            throw new DatabaseError('Database error retrieving plants.');
        }
    }
}