import { CoreEntityIdPrefix, LogLevel } from '@shared/common/enum';
import { LogEntry } from '@shared/common/types';
import { LogData, ILogData } from './data/log-data';
import { IDatabaseClient } from './interfaces';
import { DateTimeUtil, EntityIdUtil } from './utility';

export enum LogBehavior {
    Ignore = 'ignore',
    Console = 'console',
    Database = 'database'
}

export type LoggerConfig = {
    error: LogBehavior;
    warn: LogBehavior;
    info: LogBehavior;
};

export class AppLogger {

    constructor(private logData: ILogData, private config: LoggerConfig) {
    }

    public static forPgDatabase(db: IDatabaseClient, config: LoggerConfig): AppLogger {
        return new AppLogger(new LogData(db), config);
    }

    public static fromEnvironment(db: IDatabaseClient): AppLogger {
        const config: LoggerConfig = {
            error: (process.env.LOG_LEVEL_ERROR as LogBehavior) || LogBehavior.Database,
            warn: (process.env.LOG_LEVEL_WARN as LogBehavior) || LogBehavior.Console,
            info: (process.env.LOG_LEVEL_INFO as LogBehavior) || LogBehavior.Console
        };
        return AppLogger.forPgDatabase(db, config);
    }

    public error(userId: string, context: string, message: string): void {
        this.processLog(userId, context, LogLevel.ERROR, message, this.config.error);
    }

    public warn(userId: string, context: string, message: string): void {
        this.processLog(userId, context, LogLevel.WARN, message, this.config.warn);
    }

    public info(userId: string, context: string, message: string): void {
        this.processLog(userId, context, LogLevel.INFO, message, this.config.info);
    }

    private processLog(userId: string, context: string, level: LogLevel, message: string, behavior: LogBehavior): void {
        if (behavior === LogBehavior.Ignore) {
            return;
        }

        const logEntry = this.createLogEntry(userId, context, level, message);

        if (behavior === LogBehavior.Database) {
            this.logData.create(logEntry);
        }

        const formatted = this.formatForConsole(logEntry);
        switch (level) {
            case LogLevel.ERROR:
                console.error(formatted);
                break;
            case LogLevel.WARN:
                console.warn(formatted);
                break;
            case LogLevel.INFO:
            default:
                console.info(formatted);
                break;
        }
    }

    private createLogEntry(userId: string, context: string, level: LogLevel, message: string): LogEntry {
        return {
            id: EntityIdUtil.generate(CoreEntityIdPrefix.LogEntry),
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now(),
            userId,
            context,
            message,
            level
        };
    }

    private formatForConsole(entry: LogEntry): string {
        const timestamp = entry.createdAt.toISOString();
        return `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.context}] [${entry.userId}]: ${entry.message}`;
    }
}