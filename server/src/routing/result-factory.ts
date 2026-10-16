import { OperationStatus } from '@shared/core/enum';
import { DateTimeUtil } from '@server/utility';
import { OperationResult } from './operation';

export class Result {
    public static success<T>(data?: T): OperationResult<T> {
        return {
            success: true,
            status: OperationStatus.Success,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            data
        };
    }

    public static successCreated<T>(data?: T): OperationResult<T> {
        return {
            success: true,
            status: OperationStatus.SuccessCreated,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            data
        };
    }

    public static successUpdated<T>(data?: T): OperationResult<T> {
        return {
            success: true,
            status: OperationStatus.SuccessUpdated,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            data
        };
    }

    public static successDeleted<T>(data?: T): OperationResult<T> {
        return {
            success: true,
            status: OperationStatus.SuccessDeleted,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            data
        };
    }

    public static successFile(contentType: string, fileName: string, data: string): OperationResult<string> {
        return {
            success: true,
            status: OperationStatus.Success,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            data,
            file: {
                contentType,
                fileName: fileName
            }
        };
    }

    public static userError<T>(message: string, code = 'BAD_REQUEST', details?: unknown): OperationResult<T> {
        return {
            success: false,
            status: OperationStatus.UserError,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            error: {
                code,
                message,
                ...(details !== undefined && { details })
            }
        };
    }

    public static userErrorNotFound<T>(message = 'Resource not found', code = 'NOT_FOUND'): OperationResult<T> {
        return {
            success: false,
            status: OperationStatus.NotFound,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            error: {
                code,
                message
            }
        };
    }

    public static unauthorized<T>(message = 'Not authorized', code = 'UNAUTHORIZED'): OperationResult<T> {
        return {
            success: false,
            status: OperationStatus.Unauthorized,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            error: {
                code,
                message
            }
        };
    }

    public static forbidden<T>(message = 'Forbidden', code = 'FORBIDDEN'): OperationResult<T> {
        return {
            success: false,
            status: OperationStatus.Forbidden,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            error: {
                code,
                message
            }
        };
    }

    public static tooManyRequests<T>(message: string, code = 'TOO_MANY_REQUESTS'): OperationResult<T> {
        return {
            success: false,
            status: OperationStatus.TooManyRequests,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            error: {
                code,
                message
            }
        };
    }

    public static internalError<T>(
        message = 'An unexpected error occurred',
        code = 'INTERNAL_ERROR'
    ): OperationResult<T> {
        return {
            success: false,
            status: OperationStatus.UnhandledError,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            error: {
                code,
                message
            }
        };
    }
}
