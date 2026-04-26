import { Router } from 'express';
import { OperationResult } from '@shared/core/contracts';
import { AppLogger } from './../core/logger';
import { AuthController } from './../core/auth-controller';
import { ResultUtil } from './../utility';
import { ApiHandler } from './api-handler';
import { resolveUser, requireAuth } from './auth-middleware';

const router = Router();

type AuthRequest = {
    username: string;
    password?: string;
    name?: string;
    oldPassword?: string;
    newPassword?: string;
};

const controller = new AuthController();
const handler = new ApiHandler(AppLogger.fromEnvironment());

router.post('/login', (req, res) => {
    handler.execute(req, res, 'login', async (context) => {
        const { username, password } = req.body as AuthRequest;
        const result = await controller.loginUser(username, password);

        if (!result.success || !result.data) {
            return result;
        }

        context.req.session.user = result.data;
        return result;
    });
});

router.post('/register', (req, res) => {
    handler.execute(req, res, 'register', async (context) => {
        const { username, name, password } = req.body as AuthRequest;

        if (!username || !name || !password) {
            return ResultUtil.userError('Username, name, and password are required.');
        }

        const result = await controller.createUser(username, name, password);
        if (!result.success || !result.data) {
            return result;
        }

        // Auto-login after registration
        context.req.session.user = result.data;
        return result;
    });
});

router.put('/password', requireAuth, (req, res) => {
    handler.execute(req, res, 'changePassword', async (context) => {
        const { oldPassword, newPassword } = req.body as AuthRequest;

        if (!oldPassword || !newPassword) {
            return ResultUtil.userError('Missing required fields.');
        }

        return await controller.changePassword(context.userId!, oldPassword, newPassword);
    });
});

router.post('/logout', (req, res) => {
    handler.execute(req, res, 'logout', async (context) => {
        const session = context.req.session;
        if (!session) {
            return ResultUtil.success();
        }

        return new Promise<OperationResult<void>>((resolve) => {
            session.destroy((err) => {
                if (err) {
                    return resolve(ResultUtil.internalError('Could not log out.'));
                }

                // Explicitly clear the cookie with matching options
                res.clearCookie('connect.sid', {
                    path: '/',
                    secure: process.env.NODE_ENV === 'production',
                    httpOnly: true
                });

                resolve(ResultUtil.success());
            });
        });
    });
});

router.get('/me', resolveUser, (req, res) => {
    handler.execute(req, res, 'me', async (context) => {
        return ResultUtil.success(context.req.session.user);
    });
});

export default router;