import { Router } from 'express';
import { OperationResult } from '@shared/core/contracts';
import { ICoreUserData } from '@server-core/data/user-data';
import { ApiHandler } from '@server-core/api-handler';
import { AppLogger } from '@server-core/logger';
import { ResultUtil } from '@server-core/utility';
import { AuthController } from './auth-controller';

type AuthRequest = {
    username: string;
    password?: string;
    name?: string;
    oldPassword?: string;
    newPassword?: string;
};

// TODO: needs tests

export function createAuthRouter(userData: ICoreUserData, logger: AppLogger, requireAuthMiddleware: any, resolveUserMiddleware: any) {
    const router = Router();
    const controller = new AuthController(userData);
    const handler = new ApiHandler(logger);

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

    router.put('/password', requireAuthMiddleware, (req, res) => {
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

    router.get('/me', resolveUserMiddleware, (req, res) => {
        handler.execute(req, res, 'me', async (context) => {
            return ResultUtil.success(context.req.session.user);
        });
    });

    return router;
}