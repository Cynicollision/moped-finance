import { Router, Request, Response } from 'express';
import { User } from '@shared/core/types/user';
import { ApiHandler } from './api-handler';
import { AuthLogic } from './../feature-logic/auth-logic';
import { resolveUser } from './../middleware/auth-middleware';

const router = Router();

type AuthRequest = {
    username: string;
    password?: string;
};

const authLogic = new AuthLogic();

router.post('/login', async (req: Request, res: Response) => {
    // TODO: cleanup type usage
    const { username } = req.body as AuthRequest;

    // TODO: get user from database
    const user = await authLogic.loginUser(username);

    if (!user) {
        return ApiHandler.failUnauthorized(res);
    }

    req.session.user = user;

    return ApiHandler.succeed(res, user);
});

router.post('/logout', async (req: Request, res: Response) => {
    req.session.destroy((err) => {
        if (err) {
            return ApiHandler.failInternalError(res, 'Could not log out.');
        }
        res.clearCookie('connect.sid');
        return ApiHandler.succeed(res);
    });
});

router.get('/me', resolveUser, async (req: Request, res: Response) => {
    const user = ApiHandler.getUser(req);

    if (!user) {
        // TODO: is 401 correct here? Or 200 w/ success = false for more graceful handling on client?
        return ApiHandler.failUnauthorized(res);
    }

    return ApiHandler.succeed(res, user);
});

export default router;