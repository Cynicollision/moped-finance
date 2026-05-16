import { Request, Response } from 'express';
import { OperationResult } from '@shared/common/contracts/operation-result';
import { ApiUtil } from './utility/api-util';
import { AppLogger } from './logger';

export type ExecutionContext = {
    userId?: string;
    context: string;
    req: Request;
}

export class ApiHandler {

    constructor(private logger: AppLogger) {
    }

    async execute<T>(req: Request, res: Response, context: string, operation: (context: ExecutionContext) => Promise<OperationResult<T>>): Promise<OperationResult<T>> {
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
            return ApiUtil.sendResult(res, result);
        }
        catch (error: any) {
            this.logger.error(userIdForLog, context, `Internal error: ${context}. Error: ${error.message || error}`);
            return ApiUtil.internalError<T>(res, error);
        }
    }
}