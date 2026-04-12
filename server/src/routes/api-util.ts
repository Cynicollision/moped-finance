import { Request, Response } from 'express';
import { OperationResult } from '@shared/core/contracts/operation-result';
import { User } from '@shared/core/types/user';
import { DateTimeUtil } from './../utility/date-time';

export class ApiUtil {

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

    public static success<T>(res: Response, data?: T): OperationResult<T> {
        const result = this.createOperationResult(true, data);
        res.status(200).json(result);
        return result;
    }

    public static badRequest<T>(res: Response, message: string): OperationResult<T> {
        const result = this.createOperationResult<T>(false, undefined, {
            code: 'BAD_REQUEST',
            message: message
        });
        res.status(400).json(result);
        return result;
    }

    public static unauthorized<T>(res: Response): OperationResult<T> {
        const result = this.createOperationResult<T>(false, undefined, {
            code: 'UNAUTHORIZED',
            message: 'Not authenticated'
        });
        res.status(401).json(result);
        return result;
    }

    public static forbidden<T>(res: Response, message: string = 'Access denied'): OperationResult<T> {
        const result = this.createOperationResult<T>(false, undefined, {
            code: 'FORBIDDEN',
            message: message
        });
        res.status(403).json(result);
        return result;
    }

    public static notFound<T>(req: Request, res: Response): OperationResult<T> {
        const result = this.createOperationResult<T>(false, undefined, {
            code: 'NOT_FOUND',
            message: `${req.originalUrl} not found.`
        });
        res.status(404).json(result);
        return result;
    }

    public static internalError<T>(res: Response, error: unknown): OperationResult<T> {
        const result = this.createOperationResult<T>(false, undefined, {
            code: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred'
        });
        res.status(500).json(result);
        return result;
    }

    private static createOperationResult<T>(success: boolean, data?: T, error?: any): OperationResult<T> {
        return {
            success,
            timestamp: DateTimeUtil.getCurrentTimestamp(),
            data,
            error
        };
    }
}
