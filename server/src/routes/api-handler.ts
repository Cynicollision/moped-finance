import { Request, Response } from 'express';
import { OperationResult } from '@shared/types/operation-result';
import { User } from '@shared/types/entities/core/user';
import { getCurrentTimestamp } from './../utility/date-time-util';

export class ApiHandler {

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

    public static getUser(req: Request): User | undefined {
        if (req.session?.user) {
            return req.session.user;
        }
    }

    public static failNotFound(req: Request, res: Response): void {
        res.status(404).json(`Route ${req.originalUrl} not found.`);
    }

    public static failUnauthorized(res: Response): void {
        const result = this.createErrorResponse('UNAUTHORIZED', 'Not authenticated');
        res.status(401).json(result);
    }

    // TODO: accept OperationResult<T> instead?
    // TODO: log the error somewhere
    public static failInternalError(res: Response, error: unknown): void {
        const result = this.createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred');
        res.status(500).json(result);
    }

    public static succeed<T>(res: Response, data?: T): void {
        const result = this.createSuccessResponse<T>(data);
        res.status(200).json(result);
    }
}