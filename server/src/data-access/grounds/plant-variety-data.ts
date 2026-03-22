import { PlantVariety } from '@shared/grounds/types';
import { databasePool, DatabaseError } from './../db-client';

export interface IGroundsPlantVarietyData {
    retrieveAll(userId: string): Promise<PlantVariety[]>;
}

export class GroundsPlantVarietyData implements IGroundsPlantVarietyData {

    async retrieveAll(userId: string): Promise<PlantVariety[]> {
        try {
            const result = await databasePool.query(
                `SELECT 
                    pv.id,
                    pv.user_id,
                    pv.common_name,
                    pv.family_name,
                    pv.scientific_name,
                    pv.fertilizer_notes,
                    pv.pruning_notes,
                    pv.soil_notes,
                    pv.sunlight_notes,
                    pv.watering_notes
                FROM grounds.plant_varieties AS pv
                WHERE pv.user_id = $1`,
                [userId]
            );
            return result.rows;
        }
        catch (error) {
            throw new DatabaseError('Database error retrieving plant varieties.');
        }
    }
}