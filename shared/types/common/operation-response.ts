export interface OperationResponse<T = void> {
  success: boolean;
  data?: T;
  
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };

  timestamp: string;
}