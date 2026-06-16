import { OperationResult } from '@shared/core/contracts';
import { OperationStatus } from '@shared/core/enum';
import { DateTimeUtil } from './date-time-util';

// TODO rename file: result-factory.ts

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

    // public static successAccepted<T>(data?: T): OperationResult<T> {
    //     return {
    //         success: true,
    //         status: OperationStatus.SuccessAccepted,
    //         timestamp: DateTimeUtil.getCurrentTimestamp(),
    //         data
    //     };
    // }

    public static userError<T>(message: string, code: string = 'BAD_REQUEST'): OperationResult<T> {
        return {
            success: false,
            status: OperationStatus.UserError,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            error: {
                code,
                message
            }
        };
    }

    public static userErrorNotFound<T>(message: string = 'Resource not found or access denied', code: string = 'NOT_FOUND'): OperationResult<T> {
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

    public static forbidden<T>(message: string = 'Access denied', code: string = 'FORBIDDEN'): OperationResult<T> {
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

    public static unauthorized<T>(message: string = 'Not authorized', code: string = 'UNAUTHORIZED'): OperationResult<T> {
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

    public static notFound<T>(message: string = 'Not found', code: string = 'NOT_FOUND'): OperationResult<T> {
        return {
            success: false,
            status: OperationStatus.UserError,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            error: {
                code,
                message
            }
        };
    }

    public static internalError<T>(message: string = 'An unexpected error occurred', code: string = 'INTERNAL_ERROR'): OperationResult<T> {
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
