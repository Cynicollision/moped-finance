export interface OperationResult<T = void> {
  success: boolean;
  timestamp: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}
// TODO rename file