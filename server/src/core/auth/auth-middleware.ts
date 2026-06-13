import { Request, Response, NextFunction } from 'express';
import { ICoreUserData } from '@server-core/data/user-data';
import { ApiUtil } from '@server-core/utility';
import { AuthController } from './auth-controller';

export function createAuthMiddleware(userData: ICoreUserData) {
    const controller = new AuthController(userData);

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
        const user = ApiUtil.getUser(req);
        if (user) {
            next();
        }
        else {
            ApiUtil.unauthorized(res);
        }
    };

    return { resolveUser, requireAuth };
}