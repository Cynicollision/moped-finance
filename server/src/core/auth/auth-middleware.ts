import { Request, Response, NextFunction } from 'express';
import { Result } from '@server-core/utility';
import { AuthController } from './auth-controller';
import { UserContext } from './user-context';

export type AuthMiddleware = {
    resolveUser: (req: Request, res: Response, next: NextFunction) => Promise<void>;
    requireAuth: (req: Request, res: Response, next: NextFunction) => void;
}

export function buildAuthMiddleware(controller: AuthController): AuthMiddleware {
    const resolveUser = async (req: Request, _res: Response, next: NextFunction) => {
        if (!req.session?.user && !(req as any).user) {
            const authHeader = req.headers.authorization;
            if (authHeader && authHeader.startsWith('Basic ')) {
                const b64auth = authHeader.substring(6);
                const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':');

                if (username && password) {
                    const result = await controller.loginUser(username, password);
                    if (result.success && result.data) {
                        (req as any).user = result.data;
                    }
                }
            }
        }
        next();
    };

    const requireAuth = (req: Request, res: Response, next: NextFunction) => {
        const user = UserContext.fromRequest(req).getUser();
        if (user) {
            next();
        }
        else {
            res.status(401).json(Result.unauthorized());
        }
    };

    return { resolveUser, requireAuth };
}