import { OperationResult } from '@shared/types/common/operation-response';
import { getCurrentTimestamp } from './date-time-util';

export class OperationResultFactory {
  private static createSuccessResponse<T>(data?: T): OperationResult<T> {
    return {
      success: true,
      timestamp: getCurrentTimestamp(),
      data: data,
    };
  }

  private static createErrorResponse<T>(code: string, message: string, details?: unknown): OperationResult<T> {
    return {
      success: false,
      timestamp: getCurrentTimestamp(),
      error: {
        code,
        message,
        details,
      },
    };
  }

  public static success<T>(data?: T): OperationResult<T> {
    return this.createSuccessResponse(data);
  }

  public static error<T>(code: string, message: string, details?: unknown): OperationResult<T> {
    return this.createErrorResponse(code, message, details);
  }
}