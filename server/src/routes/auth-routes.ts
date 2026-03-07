import { Router, Request, Response } from 'express';
import { User } from '@shared/types/entities/core/user';
import { ApiHandler } from './api-handler';

const router = Router();

type AuthRequest = {
    username: string;
    password?: string;
};

router.post('/login', async (req: Request, res: Response) => {
    // TODO: cleanup type usage
    const { username } = req.body as AuthRequest;

    // TODO: get user from database
    const user: User = {
        id: '1',
        username: username,
        name: username
    };

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

router.get('/me', async (req: Request, res: Response) => {
    const user = req.session.user;

    if (!user) {
        // TODO: is 401 correct here? Or 200 w/ success = false for more graceful handling on client?
        return ApiHandler.failUnauthorized(res);
    }

    return ApiHandler.succeed(res, user);
});

export default router;