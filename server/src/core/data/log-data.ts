import { LogEntry } from '@shared/core/types';
import { IDatabaseClient } from '@server-core/interfaces';
import { DateTimeUtil } from '@server-core/utility';

export interface ILogData {
    create(log: LogEntry): Promise<void>;
}

// TODO: ORM conversion

export class LogData implements ILogData {
    constructor(private db: IDatabaseClient) { }

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

        await this.db.query(query, params);
    }
}