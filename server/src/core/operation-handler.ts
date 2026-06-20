import { Request, Response } from 'express';
import { OperationResult } from '@shared/core/contracts/operation-result';
import { ApiUtil } from './utility/api-util';
import { IAppLogger } from './logger';
import { Result } from './utility';

export type ExecutionContext = {
    userId?: string;
    context: string; // TODO: replace with: domain, operation
    req: Request;
}

export class OperationHandler {

    constructor(private logger: IAppLogger) {
    }

    async execute<T>(req: Request, res: Response, context: string, operation: (context: ExecutionContext) => Promise<OperationResult<T>>): Promise<OperationResult<T>> {
        const userId = ApiUtil.getUserId(req);

        const executionContext: ExecutionContext = {
            userId: userId,
            context: context,
            req: req
        };

        this.logger.info(userId, context, `Starting operation: ${context}`);

        try {
            const result = await operation(executionContext);
            // TODO: check success and warn if not
            this.logger.info(userId, context, `Successfully completed operation: ${context}`);
            return ApiUtil.sendResult(res, result);
        }
        catch (error: any) {
            this.logger.error(userId, context, `Internal error: ${context}. Error: ${error.message || error}`);
            return ApiUtil.sendResult(res, Result.internalError('An unexpected error occurred'));
        }
    }
}