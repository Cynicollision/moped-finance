import { Request, Response, NextFunction } from 'express';
import { ApiHandler } from './../routes/api-handler';
import { AuthLogic } from './../logic/auth-logic';

const authLogic = new AuthLogic();

export const resolveUser = async (req: Request, _res: Response, next: NextFunction) => {
    if (!req.session?.user && !(req as any).user) {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            const user = await authLogic.getUserByToken(token);
            if (user) {
                (req as any).user = user;
            }
        }
    }
    next();
};

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    const user = ApiHandler.getUser(req);
    if (user) {
        next();
    }
    else {
        return ApiHandler.failUnauthorized(res);
    }
};