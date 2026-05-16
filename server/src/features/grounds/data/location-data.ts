import { Location } from '@shared/grounds/types';
import { IOwnedResourceData, IDatabaseClient } from '@core/interfaces';

export interface IGroundsLocationData extends IOwnedResourceData<Location> {
    retrieveAll(userId: string): Promise<Location[]>;
}

export class GroundsLocationData implements IGroundsLocationData {
    constructor(private db: IDatabaseClient) { }

    public async retrieveSingle(userId: string, id: string): Promise<Location | null> {
        const result = await this.db.query(
            `SELECT 
                l.id,
                l.user_id AS "userId",
                l.name,
                l.type
            FROM grounds.locations AS l
            WHERE l.id = $1 AND l.user_id = $2`,
            [id, userId]
        );

        return result.rows[0] || null;
    }

    public async retrieveAll(userId: string): Promise<Location[]> {
        const result = await this.db.query(
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
