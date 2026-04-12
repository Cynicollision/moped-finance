import { LogEntry } from '@shared/core/types';
import { DateTimeUtil } from './../../utility/date-time';
import { databasePool } from './../db-client';

export interface ILogData {
    create(log: LogEntry): Promise<void>;
}

export class LogData implements ILogData {

    public async create(log: LogEntry): Promise<void> {
        const now = DateTimeUtil.now();

        const query = `INSERT INTO core.logs 
            (id, created_at, updated_at, user_id, level, context, message)
            VALUES ($1, $2, $3, $4, $5, $6, $7)`;

        const params = [
            log.id,
            now,
            now,
            log.userId,
            log.level,
            log.context,
            log.message
        ];

        await databasePool.query(query, params);
    }
}