import { Plant } from '@shared/grounds/types';
import { IOwnedResourceData, IDatabaseClient } from '@core/interfaces';

export interface IGroundsPlantData extends IOwnedResourceData<Plant> {
    retrieveAll(userId: string): Promise<Plant[]>;
    retrieveByVariety(userId: string, varietyId: string): Promise<Plant[]>;
    insert(plant: Plant): Promise<Plant>;
    delete(id: string, userId: string): Promise<boolean>;
}

export class GroundsPlantData implements IGroundsPlantData {
    constructor(private db: IDatabaseClient) { }

    public async retrieveSingle(userId: string, id: string): Promise<Plant | null> {
        const result = await this.db.query(
            `SELECT 
                p.id,
                p.user_id AS "userId",
                p.variety_id AS "varietyId",
                p.location_id AS "locationId",
                p.planted_date AS "plantedDate"
            FROM grounds.plants AS p
            WHERE p.id = $1 AND p.user_id = $2`,
            [id, userId]
        );

        return result.rows[0] || null;
    }

    public async retrieveAll(userId: string): Promise<Plant[]> {
        const result = await this.db.query(
            `SELECT
                p.id, 
                p.user_id AS "userId",
                p.variety_id AS "varietyId",
                p.location_id AS "locationId",
                p.planted_date AS "plantedDate"
            FROM grounds.plants AS p
            WHERE p.user_id = $1`,
            [userId]
        );
        return result.rows;
    }

    async retrieveByVariety(userId: string, varietyId: string): Promise<Plant[]> {
        const result = await this.db.query(
            `SELECT
                p.id, 
                p.user_id AS "userId",
                p.variety_id AS "varietyId",
                p.location_id AS "locationId",
                p.planted_date AS "plantedDate"
            FROM grounds.plants AS p
            WHERE p.user_id = $1 AND p.variety_id = $2`,
            [userId, varietyId]
        );
        return result.rows;
    }

    async insert(plant: Plant): Promise<Plant> {
        const result = await this.db.query(
            `INSERT INTO grounds.plants (id, user_id, variety_id, location_id, planted_date)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING 
                id, 
                user_id AS "userId",
                variety_id AS "varietyId",
                location_id AS "locationId",
                planted_date AS "plantedDate"`,
            [
                plant.id,
                plant.userId,
                plant.varietyId,
                plant.locationId,
                plant.plantedDate
            ]
        );
        return result.rows[0];
    }

    async delete(id: string, userId: string): Promise<boolean> {
        const result = await this.db.query(
            `DELETE FROM grounds.plants
             WHERE id = $1 AND user_id = $2`,
            [id, userId]
        );
        return result.rowCount ? result.rowCount > 0 : false;
    }
}