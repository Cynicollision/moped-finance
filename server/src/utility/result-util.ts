import { OperationResult } from '@shared/core/contracts/operation-result';
import { OperationStatus } from '@shared/core/enum/operation-status';
import { DateTimeUtil } from './date-time-util';

export class ResultUtil {
    public static success<T>(data?: T): OperationResult<T> {
        return {
            success: true,
            status: OperationStatus.Success,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            data
        };
    }

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

    public static unauthorized<T>(message: string = 'Not authenticated', code: string = 'UNAUTHORIZED'): OperationResult<T> {
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
            // We use UserError for not found typically in APIs, or we could add a NotFound status.
            // Using UserError as per plan for missing resources/ownership.
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
