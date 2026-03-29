import { Request, Response } from 'express';
import { OperationResult } from '@shared/core/contracts/operation-result';
import { User } from '@shared/core/types/user';
import { DateTimeUtil } from './../utility/date-time';

export class ApiHandler {

    private static createSuccessResponse<T>(data?: T): OperationResult<T> {
        return {
            success: true,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            data: data,
        };
    }

    private static createErrorResponse<T>(code: string, message: string, details?: unknown): OperationResult<T> {
        return {
            success: false,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
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

        // Check if user was already resolved and attached to request (e.g. by middleware)
        if ((req as any).user) {
            return (req as any).user;
        }

        return undefined;
    }

    public static succeed<T>(res: Response, data?: T): void {
        const result = this.createSuccessResponse<T>(data);
        res.status(200).json(result);
    }

    public static failBadRequest(res: Response, message: string): void {
        const result = this.createErrorResponse('BAD_REQUEST', message);
        res.status(400).json(result);
    }

    public static failUnauthorized(res: Response): void {
        const result = this.createErrorResponse('UNAUTHORIZED', 'Not authenticated');
        res.status(401).json(result);
    }

    public static failNotFound(req: Request, res: Response): void {
        res.status(404).json(`${req.originalUrl} not found.`);
    }

    // TODO: accept OperationResult<T> instead?
    // TODO: log the error somewhere
    public static failInternalError(res: Response, error: unknown): void {
        const result = this.createErrorResponse('INTERNAL_ERROR', 'An unexpected error occurred');
        res.status(500).json(result);
    }
}