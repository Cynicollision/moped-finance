import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { IAppLogger } from './logger';
import { ApiUtil, Result } from './utility';

export class RequestSchemaValidator {
    constructor(private readonly logger: IAppLogger, private readonly schemaName: string) {
    }

    params(schema: z.ZodObject): (req: Request, res: Response, next: NextFunction) => void {
        return (req: Request, res: Response, next: NextFunction) => {
            const userId = ApiUtil.getUserId(req);
            const result = schema.safeParse(req.params);
            if (!result.success) {
                const context = `${this.schemaName}:params`;
                const messages = (result.error as ZodError).issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
                const errorMessage = `Invalid request params: ${messages}`;
                this.logger.warn(userId, context, errorMessage);
                ApiUtil.sendResult(res, Result.userError(errorMessage));
                return;
            }
            next();
        };
    }

    id(): (req: Request, res: Response, next: NextFunction) => void {
        return this.params(z.object({ id: z.string().min(1) }));
    }

    body(schema: z.ZodObject): (req: Request, res: Response, next: NextFunction) => void {
        return (req: Request, res: Response, next: NextFunction) => {
            const userId = ApiUtil.getUserId(req);
            const result = schema.safeParse(req.body);
            if (!result.success) {
                const context = `${this.schemaName}:body`;
                const messages = (result.error as ZodError).issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
                const errorMessage = `Invalid request body: ${messages}`;
                this.logger.warn(userId, context, errorMessage);
                ApiUtil.sendResult(res, Result.userError(errorMessage));
                return;
            }
            req.body = result.data;
            next();
        };
    }
}