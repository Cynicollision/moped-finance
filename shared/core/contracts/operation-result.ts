import { OperationStatus } from './../enum';

export interface OperationFile {
    fileName: string;
    contentType: string;
}

export interface OperationResult<T = void> {
    success: boolean;
    status: OperationStatus;
    timestamp: string;
    data?: T;
    file?: OperationFile;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}
