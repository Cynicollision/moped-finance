import { Router, Request, Response } from 'express';
import { User } from '@shared/core/types/user';
import { ApiHandler } from './api-handler';
import { AuthLogic } from './../logic/auth-logic';
import { resolveUser, requireAuth } from './../middleware/auth-middleware';

const router = Router();

type AuthRequest = {
    username: string;
    password?: string;
    name?: string;
    oldPassword?: string;
    newPassword?: string;
};

const authLogic = new AuthLogic();

router.post('/login', async (req: Request, res: Response) => {
    try {
        const { username, password } = req.body as AuthRequest;

        const user = await authLogic.loginUser(username, password);

        if (!user) {
            return ApiHandler.failUnauthorized(res);
        }

        req.session.user = user;

        return ApiHandler.succeed(res, user);
    } catch (err) {
        return ApiHandler.failInternalError(res, 'Login failed');
    }
});

router.post('/register', async (req: Request, res: Response) => {
    try {
        const { username, name, password } = req.body as AuthRequest;

        if (!username || !name || !password) {
            return ApiHandler.failBadRequest(res, 'Username, name, and password are required.');
        }

        const user = await authLogic.createUser(username, name, password);

        // Auto-login after registration
        req.session.user = user;

        return ApiHandler.succeed(res, user);
    } catch (err: any) {
        if (err.message === 'Username already exists') {
            return ApiHandler.failBadRequest(res, 'Username already exists.');
        }
        return ApiHandler.failInternalError(res, 'Registration failed');
    }
});

router.put('/password', requireAuth, async (req: Request, res: Response) => {
    try {
        const { oldPassword, newPassword } = req.body as AuthRequest;
        const user = ApiHandler.getUser(req);

        if (!user || !oldPassword || !newPassword) {
            return ApiHandler.failBadRequest(res, 'Missing required fields.');
        }

        await authLogic.changePassword(user.id, oldPassword, newPassword);

        return ApiHandler.succeed(res);
    } catch (err: any) {
        if (err.message === 'Invalid old password.') {
            return ApiHandler.failBadRequest(res, 'Invalid old password.');
        }
        return ApiHandler.failInternalError(res, 'Failed to update password');
    }
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

    // if (!user) {
    //     return ApiHandler.failUnauthorized(res);
    // }

    return ApiHandler.succeed(res, user);
});

export default router;