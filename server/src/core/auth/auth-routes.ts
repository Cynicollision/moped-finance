import { Router } from 'express';
import { OperationResult } from '@shared/core/contracts';
import { IAppLogger } from '@server-core/logging';
import { OperationDefinition, OperationHandler, Result } from '@server-core/routing';
import { AuthController } from './auth-controller';
import { AuthMiddleware } from './auth-middleware';

type AuthRequest = {
    username: string;
    password?: string;
    name?: string;
    oldPassword?: string;
    newPassword?: string;
};

export function buildAuthRouter(logger: IAppLogger, controller: AuthController, middleware: AuthMiddleware) {
    const domain = 'Auth';
    const handler = new OperationHandler(logger);
    const router = Router();

    router.post('/login', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'login' };
        handler.execute(req, res, op, async (context) => {
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
        const op: OperationDefinition = { domain, operation: 'register' };
        handler.execute(req, res, op, async (context) => {
            const { username, name, password } = req.body as AuthRequest;

            // TODO: move validation into controller
            if (!username || !name || !password) {
                return Result.userError('Username, name, and password are required.');
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

    router.put('/password', middleware.requireAuth, (req, res) => {
        const op: OperationDefinition = { domain, operation: 'changePassword' };
        handler.execute(req, res, op, async (context) => {
            const { oldPassword, newPassword } = req.body as AuthRequest;

            // TODO: move to controller
            if (!oldPassword || !newPassword) {
                return Result.userError('Missing required fields.');
            }

            const userId = context.user.getId();
            return await controller.changePassword(userId, oldPassword, newPassword);
        });
    });

    router.post('/logout', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'logout' };
        handler.execute(req, res, op, async (context) => {
            const session = context.req.session;
            if (!session) {
                return Result.success();
            }

            return new Promise<OperationResult<void>>((resolve) => {
                session.destroy((err) => {
                    if (err) {
                        return resolve(Result.internalError('Could not log out.'));
                    }

                    // Explicitly clear the cookie with matching options
                    res.clearCookie('connect.sid', {
                        path: '/',
                        secure: process.env.NODE_ENV === 'production',
                        httpOnly: true
                    });

                    resolve(Result.success());
                });
            });
        });
    });

    router.get('/me', middleware.resolveUser, (req, res) => {
        const op: OperationDefinition = { domain, operation: 'me' };
        handler.execute(req, res, op, async (context) => {
            return Result.success(context.req.session.user);
        });
    });

    return router;
}