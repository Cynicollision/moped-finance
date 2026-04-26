import { OperationStatus } from './../enum';

export interface OperationResult<T = void> {
    success: boolean;
    status: OperationStatus;
    timestamp: string;
    data?: T;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}
