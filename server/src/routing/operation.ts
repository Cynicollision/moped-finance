import { Request, Response } from 'express';
import { OperationStatus } from '@shared/core/enum'
import { UserContext } from '@server/auth';
import { IAppLogger } from '@server/logging';
import { Result } from './result-factory';

export type OperationDefinition = {
    domain: string;
    operation: string;
}

export interface ResultFileMeta {
    fileName: string;
    contentType: string;
}

export interface OperationResult<T = void> {
    success: boolean;
    status: OperationStatus;
    timestamp: string;
    data?: T;
    file?: ResultFileMeta;
    error?: {
        code: string;
        message: string;
        details?: unknown;
    };
}

export class OperationContext {
    public readonly user: UserContext;
    public readonly req: Request;
    public readonly operation: OperationDefinition;

    constructor(operation: OperationDefinition, req: Request) {
        this.user = UserContext.fromRequest(req);
        this.req = req;
        this.operation = operation;
    }

    toString(): string {
        return `${this.operation.domain}.${this.operation.operation}`;
    }
}

export class OperationHandler {

    constructor(private logger: IAppLogger) {
    }

    async execute<T>(req: Request, res: Response, operationDef: OperationDefinition, operation: (context: OperationContext) => Promise<OperationResult<T>>): Promise<OperationResult<T>> {
        const context = new OperationContext(operationDef, req);
        const userId = context.user.getId();

        this.logger.info(userId, 'Starting operation', context);

        try {
            const result = await operation(context);

            if (!result.success) {
                this.logger.warn(userId, `Operation failed: ${result.error?.message}`, context);
            }
            else {
                this.logger.info(userId, 'Successfully completed operation', context);
            }

            return this.sendResult(res, result);
        }
        catch (error: any) {
            this.logger.error(userId, 'Internal error: ' + error.message || error, context);
            return this.sendResult(res, Result.internalError('An unexpected error occurred'));
        }
    }

    private sendResult<T>(res: Response, result: OperationResult<T>): OperationResult<T> {
        let statusCode = 200;
        switch (result.status) {
            case OperationStatus.Success:
            case OperationStatus.SuccessUpdated:
                statusCode = 200;
                break;
            case OperationStatus.SuccessCreated:
                statusCode = 201;
                break;
            case OperationStatus.SuccessDeleted:
                statusCode = 204;
                break;
            case OperationStatus.UserError:
                statusCode = 400;
                break;
            case OperationStatus.NotFound:
                statusCode = 404;
                break;
            case OperationStatus.UnhandledError:
            default:
                statusCode = 500;
                break;
        }

        if (result.success && result.file) {
            res.setHeader('Content-Type', result.file.contentType);
            res.attachment(result.file.fileName);
            res.send(result.data);
        }
        else if (result.success) {
            if (result.data !== undefined) {
                res.status(statusCode).json(result.data);
            }
            else {
                res.status(statusCode).send();
            }
        }
        else {
            res.status(statusCode).json(result.error);
        }

        return result;
    }
}