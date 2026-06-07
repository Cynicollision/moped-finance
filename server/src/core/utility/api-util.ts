import { Request, Response } from 'express';
import { OperationResult } from '@shared/core/contracts';
import { User } from '@shared/core/types';
import { OperationStatus } from '@shared/core/enum';
import { ResultUtil } from './result-util';

export class ApiUtil {

    private static anonymousUserId = 'anonymous';

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

    public static getUserId(req: Request): string {
        const user = ApiUtil.getUser(req);
        const userId = user?.id || ApiUtil.anonymousUserId;
        return userId;
    }

    public static sendResult<T>(res: Response, result: OperationResult<T>): OperationResult<T> {
        let statusCode = 200;
        switch (result.status) {
            case OperationStatus.Success:
                statusCode = 200; // TODO: need to support 201 created, 202 accepted, etc.
                break;
            case OperationStatus.UserError:
                statusCode = 400;
                break;
            case OperationStatus.Unauthorized:
                statusCode = 401;
                break;
            case OperationStatus.Forbidden:
                statusCode = 403;
                break;
            case OperationStatus.UnhandledError:
            default:
                statusCode = 500;
                break;
        }

        res.status(statusCode).json(result);
        return result;
    }

    public static success<T>(res: Response, data?: T): OperationResult<T> {
        return this.sendResult(res, ResultUtil.success(data));
    }

    public static badRequest<T>(res: Response, message: string): OperationResult<T> {
        return this.sendResult(res, ResultUtil.userError(message));
    }

    public static unauthorized<T>(res: Response): OperationResult<T> {
        return this.sendResult(res, ResultUtil.unauthorized());
    }

    public static forbidden<T>(res: Response, message: string = 'Access denied'): OperationResult<T> {
        return this.sendResult(res, ResultUtil.forbidden(message));
    }

    public static notFound<T>(req: Request, res: Response): OperationResult<T> {
        return this.sendResult(res, ResultUtil.notFound(`${req.originalUrl} not found.`));
    }

    public static internalError<T>(res: Response, error: unknown): OperationResult<T> {
        return this.sendResult(res, ResultUtil.internalError('An unexpected error occurred'));
    }
}
