import { OperationResponse } from '@shared/types/common/operation-response';
import { getCurrentTimestamp } from './date-time-util';

export function createSuccessMessageResponse(message?: string): OperationResponse<string> {
  return {
    success: true,
    timestamp: getCurrentTimestamp(),
    data: message,
  };
}

export function createSuccessResponse<T>(data?: T): OperationResponse<T> {
  return {
    success: true,
    timestamp: getCurrentTimestamp(),
    data: data,
  };
}

export function createErrorResponse(code: string, message: string, details?: unknown): OperationResponse {
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