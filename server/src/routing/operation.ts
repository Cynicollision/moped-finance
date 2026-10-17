import { Request, Response } from 'express';
import { z } from 'zod';
import { OperationStatus } from '@shared/core/enum';
import { UserContext } from '@server/auth';
import { DatabaseErrorUtil } from '@server/data';
import { IAppLogger } from '@server/logging';
import { Result } from './result-factory';

export interface OperationDefinition {
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

/** Zod schemas for the parts of a request an operation reads. Each one that's given is parsed before the operation runs. */
export interface RequestSchemas {
    params?: z.ZodType;
    query?: z.ZodType;
    body?: z.ZodType;
}

type ParsedPart<S, K extends keyof RequestSchemas> =
    S extends Record<K, infer Schema> ? (Schema extends z.ZodType ? z.output<Schema> : undefined) : undefined;

/** The parsed, typed request parts handed to an operation; a part without a schema is `undefined`. */
export interface RequestInput<S extends RequestSchemas> {
    params: ParsedPart<S, 'params'>;
    query: ParsedPart<S, 'query'>;
    body: ParsedPart<S, 'body'>;
}

/** The schemas of an operation that reads no request parts. */
type NoSchemas = Record<never, never>;

type Operation<T, S extends RequestSchemas> = (
    context: OperationContext,
    input: RequestInput<S>
) => Promise<OperationResult<T>>;

const requestPartNames: Record<keyof RequestSchemas, string> = {
    params: 'params',
    query: 'query params',
    body: 'body'
};

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
    constructor(private logger: IAppLogger) {}

    /**
     * Runs an operation and sends its result. When `schemas` are given, the matching request parts are
     * parsed first: a failure is a 400 naming each invalid field, and the operation receives the parsed
     * values (with coercions, defaults and transforms applied) as `input`. The request itself isn't modified.
     */
    execute<T>(
        req: Request,
        res: Response,
        operationDef: OperationDefinition,
        operation: Operation<T, NoSchemas>
    ): Promise<OperationResult<T>>;
    execute<T, S extends RequestSchemas>(
        req: Request,
        res: Response,
        operationDef: OperationDefinition,
        schemas: S,
        operation: Operation<T, S>
    ): Promise<OperationResult<T>>;
    async execute<T>(
        req: Request,
        res: Response,
        operationDef: OperationDefinition,
        schemasOrOperation: RequestSchemas | Operation<T, NoSchemas>,
        maybeOperation?: Operation<T, RequestSchemas>
    ): Promise<OperationResult<T>> {
        const schemas = typeof schemasOrOperation === 'function' ? {} : schemasOrOperation;
        const operation = (
            typeof schemasOrOperation === 'function' ? schemasOrOperation : maybeOperation!
        ) as Operation<T, RequestSchemas>;

        const context = new OperationContext(operationDef, req);
        const userId = context.user.getId();

        this.logger.info(userId, 'Starting operation', context);

        const parsed = this.parseRequest(req, operationDef, schemas);
        if (!parsed.success) {
            this.logger.warn(userId, `Operation failed: ${parsed.message}`, context);
            return this.sendResult(res, Result.userError<T>(parsed.message));
        }

        try {
            const result = await operation(context, parsed.input);

            if (!result.success) {
                this.logger.warn(userId, `Operation failed: ${result.error?.message}`, context);
            } else {
                this.logger.info(userId, 'Successfully completed operation', context);
            }

            return this.sendResult(res, result);
        } catch (error) {
            const constraintError = DatabaseErrorUtil.getConstraintViolation(error);
            if (constraintError) {
                this.logger.warn(userId, `Operation failed: ${constraintError.message}`, context);
                return this.sendResult(res, Result.userError(constraintError.message, constraintError.code));
            }

            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(userId, 'Internal error: ' + message, context);
            return this.sendResult(res, Result.internalError('An unexpected error occurred'));
        }
    }

    private parseRequest(
        req: Request,
        operationDef: OperationDefinition,
        schemas: RequestSchemas
    ): { success: true; input: RequestInput<RequestSchemas> } | { success: false; message: string } {
        const input: Record<keyof RequestSchemas, unknown> = { params: undefined, query: undefined, body: undefined };

        for (const part of Object.keys(requestPartNames) as (keyof RequestSchemas)[]) {
            const schema = schemas[part];
            if (!schema) {
                continue;
            }

            // The body is undefined when no JSON was sent; parse it as an empty object.
            const value = part === 'body' ? (req[part] ?? {}) : req[part];
            const result = schema.safeParse(value);
            if (!result.success) {
                const issues = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
                return {
                    success: false,
                    message: `Invalid ${operationDef.domain} request ${requestPartNames[part]}: ${issues}`
                };
            }

            input[part] = result.data;
        }

        return { success: true, input: input as RequestInput<RequestSchemas> };
    }

    private sendResult<T>(res: Response, result: OperationResult<T>): OperationResult<T> {
        let statusCode: number;
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
            case OperationStatus.Unauthorized:
                statusCode = 401;
                break;
            case OperationStatus.Forbidden:
                statusCode = 403;
                break;
            case OperationStatus.NotFound:
                statusCode = 404;
                break;
            case OperationStatus.TooManyRequests:
                statusCode = 429;
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
        } else if (result.success) {
            if (result.data !== undefined) {
                res.status(statusCode).json(result.data);
            } else {
                res.status(statusCode).send();
            }
        } else {
            res.status(statusCode).json(result.error);
        }

        return result;
    }
}
