import { EntityIdPrefix, LogLevel } from '@shared/core/enum';
import { LogEntry } from '@shared/core/types';
import { DateTimeUtil } from './date-time';
import { EntityIdUtil } from './entity-id';
import { LogData, ILogData } from './../data-access/core/log-data';

// TODO: not strictly a utility. where to put? logic/core?
export class AppLogger {

    constructor(private logData: ILogData) {
    }

    public static forPgDatabase(): AppLogger {
        return new AppLogger(new LogData());
    }

    public error(userId: string, context: string, message: string): void {
        const logEntry = this.createLogEntry(userId, context, LogLevel.ERROR, message);
        this.logData.create(logEntry);
        console.error(message);
    }

    public warn(userId: string, context: string, message: string): void {
        const logEntry = this.createLogEntry(userId, context, LogLevel.WARN, message);
        this.logData.create(logEntry);
        console.warn(message);
    }

    public info(userId: string, context: string, message: string): void {
        const logEntry = this.createLogEntry(userId, context, LogLevel.INFO, message);
        this.logData.create(logEntry);
        console.info(message);
    }

    private createLogEntry(userId: string, context: string, level: LogLevel, message: string): LogEntry {
        return {
            id: EntityIdUtil.generate(EntityIdPrefix.LogEntry),
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now(),
            userId,
            context,
            message,
            level
        };
    }
}