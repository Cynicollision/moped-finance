import { Request, Response, NextFunction } from 'express';
import { ApiTokenAccess } from '@shared/core/enum';
import { Result } from '@server/routing';
import { ApiTokenController } from './api-token-controller';
import { UserContext } from './user-context';

export type AuthMiddleware = {
    /** Finance API: signs the request in with an API token (AUTH-11.6) if it sends one; otherwise the session applies. */
    resolveUser: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    /** Finance API: needs a session or token, and a read-only token may only read (AUTH-11.8). */
    requireAuth: (req: Request, res: Response, next: NextFunction) => void;
    /** Account and token management: needs a browser session; API tokens are ignored (AUTH-11.9). */
    requireSession: (req: Request, res: Response, next: NextFunction) => void;
}

const READ_METHODS = ['GET', 'HEAD'];

export function buildAuthMiddleware(apiTokenController: ApiTokenController): AuthMiddleware {
    const resolveUser = async (req: Request, res: Response, next: NextFunction) => {
        // The scheme is case-insensitive (RFC 9110)
        const [scheme, token] = (req.headers.authorization ?? '').trim().split(/\s+/);
        if (scheme?.toLowerCase() !== 'bearer') {
            return next();
        }

        try {
            // A token that fails is refused outright, even with a valid session cookie (AUTH-11.7).
            const grant = await apiTokenController.authenticate(token ?? '');
            if (!grant) {
                res.status(401).json(Result.unauthorized('Invalid or expired API token.', 'INVALID_API_TOKEN').error);
                return;
            }

            UserContext.setApiTokenUser(req, grant.user, grant.access);
            next();
        }
        catch (error) {
            // A database error: let the app's error handler log it and answer 500
            next(error);
        }
    };

    const requireAuth = (req: Request, res: Response, next: NextFunction) => {
        const context = UserContext.fromRequest(req);
        if (!context.getUser()) {
            res.status(401).json(Result.unauthorized().error);
        }
        else if (context.getApiTokenAccess() === ApiTokenAccess.ReadOnly && !READ_METHODS.includes(req.method)) {
            res.status(403).json(Result.forbidden('This API token is read-only.', 'READ_ONLY_API_TOKEN').error);
        }
        else {
            next();
        }
    };

    const requireSession = (req: Request, res: Response, next: NextFunction) => {
        if (req.session?.user) {
            next();
        }
        else {
            res.status(401).json(Result.unauthorized().error);
        }
    };

    return { resolveUser, requireAuth, requireSession };
}
