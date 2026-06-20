import { Request, Response } from 'express';
import { OperationResult } from '@shared/core/contracts';
import { OperationStatus } from '@shared/core/enum';
import { User } from '@shared/core/types';
import { Result } from './result-factory';

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
            case OperationStatus.SuccessUpdated:
                statusCode = 200;
                break;
            case OperationStatus.SuccessCreated:
                statusCode = 201;
                break;
            case OperationStatus.SuccessAccepted:
                statusCode = 202;
                break;
            case OperationStatus.SuccessDeleted:
                statusCode = 204;
                break;
            case OperationStatus.UserError:
                statusCode = 400;
                break;
            case OperationStatus.Unauthorized:
                statusCode = 401; // TODO not used?
                break;
            case OperationStatus.Forbidden:
                statusCode = 403; // TODO not used?
                break;
            case OperationStatus.NotFound:
                statusCode = 404; // TODO not used?
                break;
            case OperationStatus.UnhandledError:
            default:
                statusCode = 500; // TODO not used
                break;
        }

        if (result.success && result.file) {
            res.setHeader('Content-Type', result.file.contentType);
            res.attachment(result.file.fileName);
            res.send(result.data);
        }
        else {
            res.status(statusCode).json(result);
        }

        return result;
    }

    // public static unauthorized<T>(res: Response): OperationResult<T> {
    //     return this.sendResult(res, Result.unauthorized());
    // }

    // public static forbidden<T>(res: Response, message: string = 'Access denied'): OperationResult<T> {
    //     return this.sendResult(res, OperationResult.forbidden(message));
    // }

    // public static notFound<T>(req: Request, res: Response): OperationResult<T> {
    //     return this.sendResult(res, Result.notFound(`${req.originalUrl} not found.`));
    // }

    public static internalError<T>(res: Response, error: unknown): OperationResult<T> {
        return this.sendResult(res, Result.internalError('An unexpected error occurred'));
    }
}
