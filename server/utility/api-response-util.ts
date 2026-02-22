import { ApiResponse } from '@shared/types/common/api';
import { getCurrentTimestamp } from './date-time-util';

export function createSuccessResponse(message?: string): ApiResponse<string> {
  return {
    success: true,
    timestamp: getCurrentTimestamp(),
    data: message,
  };
}

export function createErrorResponse(code: string, message: string, details?: unknown): ApiResponse {
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