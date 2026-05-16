import { PlantVariety } from '@shared/grounds/types';
import { IOwnedResourceData, IDatabaseClient } from '@core/interfaces';

export interface IGroundsPlantVarietyData extends IOwnedResourceData<PlantVariety> {
    retrieveAll(userId: string): Promise<PlantVariety[]>;
    insert(variety: PlantVariety): Promise<PlantVariety>;
    update(variety: PlantVariety): Promise<PlantVariety | null>;
    delete(userId: string, plantVarietyId: string): Promise<boolean>;
}

export class GroundsPlantVarietyData implements IGroundsPlantVarietyData {
    constructor(private db: IDatabaseClient) {}

    async retrieveAll(userId: string): Promise<PlantVariety[]> {
        const result = await this.db.query(
            `SELECT 
                pv.id,
                pv.user_id AS "userId",
                pv.created_at AS "createdAt",
                pv.updated_at AS "updatedAt",
                pv.category,
                pv.common_name AS "commonName",
                pv.variety_name AS "varietyName",
                pv.brand_name AS "brandName",
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

    async retrieveSingle(userId: string, plantVarietyId: string): Promise<PlantVariety | null> {
        const result = await this.db.query(
            `SELECT 
                pv.id,
                pv.user_id AS "userId",
                pv.created_at AS "createdAt",
                pv.updated_at AS "updatedAt",
                pv.category,
                pv.common_name AS "commonName",
                pv.variety_name AS "varietyName",
                pv.brand_name AS "brandName",
                pv.description,
                pv.fertilizer_notes AS "fertilizerNotes",
                pv.pruning_notes AS "pruningNotes",
                pv.soil_notes AS "soilNotes",
                pv.sunlight_notes AS "sunlightNotes",
                pv.watering_notes AS "wateringNotes"
            FROM grounds.plant_varieties AS pv
            WHERE pv.user_id = $1 AND pv.id = $2`,
            [userId, plantVarietyId]
        );
        return result.rows[0] || null;
    }

    async insert(variety: PlantVariety): Promise<PlantVariety> {
        const result = await this.db.query(
            `INSERT INTO grounds.plant_varieties (
                id,
                user_id,
                category,
                common_name,
                variety_name,
                brand_name,
                description,
                fertilizer_notes,
                pruning_notes,
                soil_notes,
                sunlight_notes,
                watering_notes
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            RETURNING 
                id,
                user_id AS "userId",
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                category,
                common_name AS "commonName",
                variety_name AS "varietyName",
                brand_name AS "brandName",
                description,
                fertilizer_notes AS "fertilizerNotes",
                pruning_notes AS "pruningNotes",
                soil_notes AS "soilNotes",
                sunlight_notes AS "sunlightNotes",
                watering_notes AS "wateringNotes"`,
            [
                variety.id,
                variety.userId,
                variety.category,
                variety.commonName,
                variety.varietyName,
                variety.brandName,
                variety.description,
                variety.fertilizerNotes,
                variety.pruningNotes,
                variety.soilNotes,
                variety.sunlightNotes,
                variety.wateringNotes
            ]
        );
        return result.rows[0];
    }

    async update(variety: PlantVariety): Promise<PlantVariety | null> {
        const result = await this.db.query(
            `UPDATE grounds.plant_varieties
             SET updated_at = NOW(),
                 category = $2,
                 common_name = $3,
                 variety_name = $4,
                 brand_name = $5,
                 description = $6,
                 fertilizer_notes = $7,
                 pruning_notes = $8,
                 soil_notes = $9,
                 sunlight_notes = $10,
                 watering_notes = $11
             WHERE id = $1 AND user_id = $12
             RETURNING 
                id,
                user_id AS "userId",
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                category,
                common_name AS "commonName",
                variety_name AS "varietyName",
                brand_name AS "brandName",
                description,
                fertilizer_notes AS "fertilizerNotes",
                pruning_notes AS "pruningNotes",
                soil_notes AS "soilNotes",
                sunlight_notes AS "sunlightNotes",
                watering_notes AS "wateringNotes"`,
            [
                variety.id,
                variety.category,
                variety.commonName,
                variety.varietyName,
                variety.brandName,
                variety.description,
                variety.fertilizerNotes,
                variety.pruningNotes,
                variety.soilNotes,
                variety.sunlightNotes,
                variety.wateringNotes,
                variety.userId
            ]
        );
        if (result.rows.length === 0) {
            return null;
        }
        return result.rows[0];
    }

    async delete(userId: string, plantVarietyId: string): Promise<boolean> {
        const result = await this.db.query(
            `DELETE FROM grounds.plant_varieties
             WHERE id = $1 AND user_id = $2`,
            [plantVarietyId, userId]
        );
        return (result.rowCount ?? 0) > 0;
    }
}