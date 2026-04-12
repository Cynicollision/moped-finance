import { Request, Response } from 'express';
import { OperationResult } from '@shared/core/contracts/operation-result';
import { ApiUtil } from './api-util';
import { AppLogger } from './../core/logger';
import { BadRequestError, UnauthorizedError, ForbiddenError } from './../utility/errors';

export type ExecutionContext = {
    userId?: string;
    context: string;
    req: Request;
}

export class ApiHandler {

    constructor(private logger: AppLogger) {
    }

    async execute<T>(req: Request, res: Response, context: string, operation: (context: ExecutionContext) => Promise<T>): Promise<OperationResult<T>> {
        const user = ApiUtil.getUser(req);
        const userIdForLog = user?.id || 'anonymous';

        const executionContext: ExecutionContext = {
            userId: user?.id,
            context: context,
            req
        };

        this.logger.info(userIdForLog, context, `Starting operation: ${context}`);

        try {
            const result = await operation(executionContext);
            this.logger.info(userIdForLog, context, `Successfully completed operation: ${context}`);
            return ApiUtil.success(res, result);
        }
        catch (error: any) {
            if (error instanceof BadRequestError) {
                this.logger.warn(userIdForLog, context, `Bad request: ${context}. Error: ${error.message || error}`);
                return ApiUtil.badRequest<T>(res, error.message);
            }

            if (error instanceof UnauthorizedError) {
                this.logger.warn(userIdForLog, context, `Unauthorized: ${context}. Error: ${error.message || error}`);
                return ApiUtil.unauthorized<T>(res);
            }

            if (error instanceof ForbiddenError) {
                this.logger.warn(userIdForLog, context, `Forbidden: ${context}. Error: ${error.message || error}`);
                return ApiUtil.forbidden<T>(res, error.message);
            }

            this.logger.error(userIdForLog, context, `Internal error: ${context}. Error: ${error.message || error}`);
            return ApiUtil.internalError<T>(res, error);
        }
    }
}