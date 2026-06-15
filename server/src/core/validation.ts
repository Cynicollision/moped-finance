import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { ApiUtil } from './utility/api-util';
import { IAppLogger } from './logger';

export class RequestSchemaValidator {
    constructor(private readonly logger: IAppLogger, private readonly schemaName: string) {
    }

    params(schema: z.ZodObject): (req: Request, res: Response, next: NextFunction) => void {
        return (req: Request, res: Response, next: NextFunction) => {
            const userId = ApiUtil.getUserId(req);
            const result = schema.safeParse(req.params);
            if (!result.success) {
                const context = `${this.schemaName}:params`
                const messages = (result.error as ZodError).issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
                this.logger.warn(userId, context, `Invalid params: ${messages}`);
                ApiUtil.badRequest(res, messages);
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
                this.logger.warn(userId, context, `Invalid body: ${messages}`);
                ApiUtil.badRequest(res, messages);
                return;
            }
            req.body = result.data;
            next();
        };
    }
}