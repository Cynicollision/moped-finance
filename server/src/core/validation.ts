import { Request, Response, NextFunction } from 'express';
import { z, ZodError } from 'zod';
import { UserContext } from './auth';
import { IAppLogger } from './logger';
import { Result } from './utility';

export class RequestSchemaValidator {
    constructor(private readonly logger: IAppLogger, private readonly schemaName: string) {
    }

    params(schema: z.ZodObject): (req: Request, res: Response, next: NextFunction) => void {
        return (req: Request, res: Response, next: NextFunction) => {
            const result = schema.safeParse(req.params);
            if (!result.success) {
                const userId = UserContext.fromRequest(req).getId();
                const messages = (result.error as ZodError).issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
                const errorMessage = `Invalid ${this.schemaName} request params: ${messages}`;

                this.logger.warn(userId, errorMessage);
                res.status(400).json(Result.userError(errorMessage));
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
            const result = schema.safeParse(req.body);
            if (!result.success) {
                const userId = UserContext.fromRequest(req).getId();
                const messages = (result.error as ZodError).issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
                const errorMessage = `Invalid ${this.schemaName} request body: ${messages}`;

                this.logger.warn(userId, errorMessage);
                res.status(400).json(Result.userError(errorMessage));
                return;
            }
            req.body = result.data;
            next();
        };
    }
}