import { CareTask } from '@shared/grounds/types';
import { IOwnedResourceData } from './../../../core/interfaces';
import { databasePool } from './../../../core/db-client';

export interface IGroundsCareTaskData extends IOwnedResourceData<CareTask> {
    retrieveAll(userId: string): Promise<CareTask[]>;
    insert(task: CareTask): Promise<CareTask>;
    update(task: CareTask): Promise<CareTask | null>;
}

export class GroundsCareTaskData implements IGroundsCareTaskData {

    public async retrieveSingle(userId: string, id: string): Promise<CareTask | null> {
        const result = await databasePool.query(
            `SELECT 
                ct.id,
                ct.created_at AS "createdAt",
                ct.updated_at AS "updatedAt",
                ct.user_id AS "userId",
                ct.name,
                ct.category,
                ct.type,
                ct.year,
                ct.target_month AS "targetMonth",
                ct.target_week AS "targetWeek",
                ct.status,
                ct.completed_date AS "completedDate",
                ct.notes,
                ct.is_annual_task AS "isAnnualTask",
                ct.product_id AS "productId"
            FROM grounds.care_tasks AS ct
            WHERE ct.id = $1 AND ct.user_id = $2`,
            [id, userId]
        );

        return result.rows[0] || null;
    }

    public async retrieveAll(userId: string): Promise<CareTask[]> {
        const result = await databasePool.query(
            `SELECT 
                ct.id,
                ct.created_at AS "createdAt",
                ct.updated_at AS "updatedAt",
                ct.user_id AS "userId",
                ct.name,
                ct.category,
                ct.type,
                ct.year,
                ct.target_month AS "targetMonth",
                ct.target_week AS "targetWeek",
                ct.status,
                ct.completed_date AS "completedDate",
                ct.notes,
                ct.is_annual_task AS "isAnnualTask",
                ct.product_id AS "productId"
            FROM grounds.care_tasks AS ct
            WHERE ct.user_id = $1`,
            [userId]
        );

        return result.rows;
    }

    public async insert(task: CareTask): Promise<CareTask> {
        const result = await databasePool.query(
            `INSERT INTO grounds.care_tasks(
                id, user_id, name, category, type, year, target_month, target_week, status, completed_date, notes, is_annual_task, product_id
            ) VALUES(
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
            ) RETURNING 
                    id,
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                user_id AS "userId",
                name,
                category,
                type,
                year,
                target_month AS "targetMonth",
                target_week AS "targetWeek",
                status,
                completed_date AS "completedDate",
                notes,
                is_annual_task AS "isAnnualTask",
                product_id AS "productId"`,
            [
                task.id, task.userId, task.name, task.category, task.type, task.year, task.targetMonth,
                task.targetWeek, task.status, task.completedDate, task.notes, task.isAnnualTask, task.productId
            ]
        );

        return result.rows[0];
    }

    public async update(task: CareTask): Promise<CareTask | null> {
        const result = await databasePool.query(
            `UPDATE grounds.care_tasks 
            SET
                name = $3,
                category = $4,
                type = $5,
                year = $6,
                target_month = $7,
                target_week = $8,
                status = $9,
                completed_date = $10,
                notes = $11,
                is_annual_task = $12,
                product_id = $13,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1 AND user_id = $2
            RETURNING 
                id,
                created_at AS "createdAt",
                updated_at AS "updatedAt",
                user_id AS "userId",
                name,
                category,
                type,
                year,
                target_month AS "targetMonth",
                target_week AS "targetWeek",
                status,
                completed_date AS "completedDate",
                notes,
                is_annual_task AS "isAnnualTask",
                product_id AS "productId"`,
            [
                task.id, task.userId, task.name, task.category, task.type, task.year, task.targetMonth,
                task.targetWeek, task.status, task.completedDate, task.notes, task.isAnnualTask, task.productId
            ]
        );

        if (result.rows.length === 0) {
            return null;
        }

        return result.rows[0];
    }
}
