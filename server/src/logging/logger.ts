import { LogLevel } from '@shared/core/enum';
import { LogEntry } from '@shared/core/types';
import { LogData, ILogData } from './log-data';
import { CoreEntityIdPrefix, EntityId, IDatabaseClient } from '@server/data';
import { OperationContext } from '@server/routing';
import { DateTimeUtil } from '@server/utility';

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

export interface IAppLogger {
    error(userId: string, message: string, context?: OperationContext): void;
    warn(userId: string, message: string, context?: OperationContext): void;
    info(userId: string, message: string, context?: OperationContext): void;
}

export class AppLogger implements IAppLogger {
    constructor(
        private logData: ILogData,
        private config: LoggerConfig
    ) {}

    public static forPgDatabase(db: IDatabaseClient, config: LoggerConfig): AppLogger {
        const logData = new LogData(db);
        return new AppLogger(logData, config);
    }

    public static fromEnvironment(db: IDatabaseClient): AppLogger {
        const config: LoggerConfig = {
            error: (process.env.LOG_LEVEL_ERROR as LogBehavior) || LogBehavior.Database,
            warn: (process.env.LOG_LEVEL_WARN as LogBehavior) || LogBehavior.Console,
            info: (process.env.LOG_LEVEL_INFO as LogBehavior) || LogBehavior.Console
        };
        return AppLogger.forPgDatabase(db, config);
    }

    public error(userId: string, message: string, context?: OperationContext): void {
        const contextStr = context ? context.toString() : '';
        this.processLog(userId, contextStr, LogLevel.ERROR, message, this.config.error);
    }

    public warn(userId: string, message: string, context?: OperationContext): void {
        const contextStr = context ? context.toString() : '';
        this.processLog(userId, contextStr, LogLevel.WARN, message, this.config.warn);
    }

    public info(userId: string, message: string, context?: OperationContext): void {
        const contextStr = context ? context.toString() : '';
        this.processLog(userId, contextStr, LogLevel.INFO, message, this.config.info);
    }

    private processLog(userId: string, context: string, level: LogLevel, message: string, behavior: LogBehavior): void {
        if (behavior === LogBehavior.Ignore) {
            return;
        }

        const logEntry = this.createLogEntry(userId, context, level, message);

        if (behavior === LogBehavior.Database) {
            // Not awaited, so logging never slows a request. The catch matters: if the database is
            // down, an unhandled rejection here would crash the process. The entry still reaches the console below.
            this.logData.create(logEntry).catch(error => {
                console.error(
                    `[${DateTimeUtil.getCurrentTimestamp()}] [ERROR] Failed to write log entry to the database: ${error?.message ?? error}`
                );
            });
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

    private createLogEntry(contextUserId: string, context: string, level: LogLevel, message: string): LogEntry {
        return {
            id: EntityId.generate(CoreEntityIdPrefix.Log),
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now(),
            contextUserId,
            context,
            message,
            level
        };
    }

    private formatForConsole(entry: LogEntry): string {
        const timestamp = entry.createdAt.toISOString();
        return `[${timestamp}] [${entry.level.toUpperCase()}] [${entry.context}] [User: ${entry.contextUserId}]: ${entry.message}`;
    }
}
