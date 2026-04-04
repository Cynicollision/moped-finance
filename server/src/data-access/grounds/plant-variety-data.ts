import { PlantVariety } from '@shared/grounds/types';
import { databasePool } from './../db-client';

export interface IGroundsPlantVarietyData {
    retrieveAll(userId: string): Promise<PlantVariety[]>;
}

export class GroundsPlantVarietyData implements IGroundsPlantVarietyData {

    async retrieveAll(userId: string): Promise<PlantVariety[]> {
        const result = await databasePool.query(
            `SELECT 
                pv.id,
                pv.user_id AS "userId",
                pv.created_at AS "createdAt",
                pv.updated_at AS "updatedAt",
                pv.category,
                pv.common_name AS "commonName",
                pv.variety_name AS "varietyName",
                pv.brand_name AS "brandName",
                pv.purchased_from AS "purchasedFrom",
                pv.description,
                pv.fertilizer_notes AS "fertilizerNotes",
                pv.pruning_notes AS "pruningNotes",
                pv.soil_notes AS "soilNotes",
                pv.sunlight_notes AS "sunlightNotes",
                pv.watering_notes AS "wateringNotes"
            FROM grounds.plant_varieties AS pv
            WHERE pv.user_id = $1`,
            [userId]
        );
        return result.rows;
    }
}