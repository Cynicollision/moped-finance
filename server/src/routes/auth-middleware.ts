import { Request, Response, NextFunction } from 'express';
import { ApiUtil } from './api-util';
import { AuthController } from './../core/auth-controller';

const controller = new AuthController();

export const resolveUser = async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.session?.user && !(req as any).user) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Basic ')) {
            const b64auth = authHeader.substring(6);
            const [username, password] = Buffer.from(b64auth, 'base64').toString().split(':');

            if (username && password) {
                const user = await controller.loginUser(username, password);
                if (user) {
                    (req as any).user = user;
                }
            }
        }
    }
    next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const user = ApiUtil.getUser(req);
    if (user) {
        next();
    }
    else {
        ApiUtil.unauthorized(res);
    }
};