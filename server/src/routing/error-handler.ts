import { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { UserContext } from '@server/auth';
import { IAppLogger } from '@server/logging';
import { Result } from './result-factory';
import { maxUploadFileSizeBytes } from './upload';

/**
 * Last-resort handler for errors raised outside `OperationHandler`: body parsing, uploads and any
 * middleware that calls `next(err)`. Without it Express replies with an HTML page that, outside
 * production, includes the stack trace. Responses use the same `{ code, message }` shape as operations
 * and never include the error's own message.
 */
export function buildErrorHandler(logger: IAppLogger): ErrorRequestHandler {
    return (err, req, res, next) => {
        if (res.headersSent) {
            next(err);
            return;
        }

        const userId = UserContext.fromRequest(req).getId();

        if (err instanceof multer.MulterError) {
            const message = err.code === 'LIMIT_FILE_SIZE'
                ? `File is too large (maximum ${maxUploadFileSizeBytes / (1024 * 1024)} MB).`
                : 'Invalid upload: send one file in the "file" field.';

            logger.warn(userId, `Upload rejected (${err.code}) on ${req.method} ${req.originalUrl}`);
            res.status(400).json(Result.userError(message).error);
            return;
        }

        // body-parser marks client errors (malformed JSON, body too large) with a 4xx status.
        const status = typeof err?.status === 'number' ? err.status : 500;
        if (status >= 400 && status < 500) {
            const message = err.type === 'entity.parse.failed' ? 'Malformed JSON in request body.' : 'Invalid request.';

            logger.warn(userId, `Request rejected (${err.type ?? status}) on ${req.method} ${req.originalUrl}`);
            res.status(status).json(Result.userError(message).error);
            return;
        }

        logger.error(userId, `Unhandled error on ${req.method} ${req.originalUrl}: ${err?.message ?? err}`);
        res.status(500).json(Result.internalError().error);
    };
}
