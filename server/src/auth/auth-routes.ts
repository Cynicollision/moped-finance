import { CookieOptions, Router } from 'express';
import { z } from 'zod';
import { IAppLogger } from '@server/logging';
import { OperationDefinition, OperationHandler, OperationResult, Result } from '@server/routing';
import { AuthController } from './auth-controller';
import { AuthMiddleware } from './auth-middleware';
import { SESSION_COOKIE_NAME } from './session';

/** `sessionCookie` is the session cookie's options (`SessionUtil.cookieOptions`), which logout clears it with. */
export function buildAuthRouter(logger: IAppLogger, controller: AuthController, middleware: AuthMiddleware, sessionCookie: CookieOptions) {
    const domain = 'Auth';
    const handler = new OperationHandler(logger);
    const router = Router();

    // POST /login - Login user
    const loginSchema = z.object({
        username: z.string().min(1),
        password: z.string().min(1)
    });

    router.post('/login', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'login' };
        handler.execute(req, res, op, { body: loginSchema }, async (context, { body }) => {
            const { username, password } = body;
            const result = await controller.loginUser(username, password);

            if (!result.success || !result.data) {
                return result;
            }

            context.req.session.user = result.data;
            return result;
        });
    });

    // GET /registration - Whether registration is open (only until the first user exists)
    router.get('/registration', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'registrationStatus' };
        handler.execute(req, res, op, async () => {
            return await controller.getRegistrationStatus();
        });
    });

    // POST /register - Register user
    const registerSchema = z.object({
        username: z.string().min(1),
        name: z.string().min(1),
        password: z.string().min(1)
    });

    router.post('/register', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'register' };
        handler.execute(req, res, op, { body: registerSchema }, async (context, { body }) => {
            const { username, name, password } = body;

            const result = await controller.createUser(username, name, password);
            if (!result.success || !result.data) {
                return result;
            }

            // Auto-login after registration
            context.req.session.user = result.data;
            return result;
        });
    });

    // PUT /password - Change Password
    const changePasswordSchema = z.object({
        oldPassword: z.string().min(1),
        newPassword: z.string().min(1)
    });

    router.put('/password', middleware.requireSession, (req, res) => {
        const op: OperationDefinition = { domain, operation: 'changePassword' };
        handler.execute(req, res, op, { body: changePasswordSchema }, async (context, { body }) => {
            const { oldPassword, newPassword } = body;

            const userId = context.user.getId();
            return await controller.changePassword(userId, oldPassword, newPassword);
        });
    });

    // POST /logout - Logout
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

                    // The browser only drops the cookie if these match the ones it was set with
                    res.clearCookie(SESSION_COOKIE_NAME, sessionCookie);

                    resolve(Result.success());
                });
            });
        });
    });

    // GET /me - Get Current User
    router.get('/me', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'me' };
        handler.execute(req, res, op, async (context) => {
            return Result.success(context.req.session.user);
        });
    });

    return router;
}