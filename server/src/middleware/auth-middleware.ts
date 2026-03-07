import { Request, Response, NextFunction } from 'express';
import { ApiHandler } from './../routes/api-handler';

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (req.session && req.session.user) {
        next();
    }
    else {
        return ApiHandler.failUnauthorized(res);
    }
};