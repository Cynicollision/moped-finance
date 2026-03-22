import { CareTask } from '@shared/grounds/types';
import { databasePool, DatabaseError } from './../db-client';

export interface IGroundsCareTaskData {
    retrieveAll(userId: string): Promise<CareTask[]>;
}

export class GroundsCareTaskData implements IGroundsCareTaskData {

    public async retrieveAll(userId: string): Promise<CareTask[]> {
        try {
            const result = await databasePool.query(
                `SELECT 
                    ct.id,
                    ct.created_at AS "createdAt",
                    ct.updated_at AS "updatedAt",
                    ct.user_id AS "userId",
                    ct.name,
                    ct.type,
                    ct.year,
                    ct.target_month AS "targetMonth",
                    ct.target_week AS "targetWeek",
                    ct.status,
                    ct.completed_date AS "completedDate",
                    ct.notes,
                    ct.is_annual_task AS "isAnnualTask"
                FROM grounds.care_tasks AS ct
                WHERE ct.user_id = $1`,
                [userId]
            );

            return result.rows;
        }
        catch (err) {
            throw new DatabaseError('Database error retrieving care tasks.');
        }
    }
}
