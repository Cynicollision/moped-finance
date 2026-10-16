import { CookieOptions, Router } from 'express';
import { z } from 'zod';
import { DISPLAY_NAME_MAX_LENGTH, USERNAME_MAX_LENGTH } from '@shared/core/util';
import { IAppLogger } from '@server/logging';
import { OperationDefinition, OperationHandler, OperationResult, Result } from '@server/routing';
import { AuthController } from './auth-controller';
import { AuthMiddleware } from './auth-middleware';
import { SESSION_COOKIE_NAME } from './session';
import { SignInLimiter } from './sign-in-limiter';

/**
 * `sessionCookie` is the session cookie's options (`SessionUtil.cookieOptions`), which logout clears it with.
 * `signInLimiter` counts failed sign-ins per network address (AUTH-10).
 */
export function buildAuthRouter(
    logger: IAppLogger,
    controller: AuthController,
    middleware: AuthMiddleware,
    sessionCookie: CookieOptions,
    signInLimiter: SignInLimiter
) {
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
            // Behind a trusted proxy (TRUST_FIRST_PROXY), Express gives the client's address, not the proxy's (AUTH-10.6)
            const address = context.req.ip ?? '';
            const minutesLockedOut = signInLimiter.minutesLockedOut(address);
            if (minutesLockedOut > 0) {
                // Refused even with the right password (AUTH-10.1)
                res.set('Retry-After', String(minutesLockedOut * 60));
                const unit = minutesLockedOut === 1 ? 'minute' : 'minutes';
                return Result.tooManyRequests(
                    `Too many failed sign-in attempts. Try again in ${minutesLockedOut} ${unit}.`,
                    'SIGN_IN_LOCKED_OUT'
                );
            }

            const { username, password } = body;
            const result = await controller.loginUser(username, password);

            if (!result.success || !result.data) {
                if (signInLimiter.recordFailure(address)) {
                    // The address, and the time on the log entry; never the username or password tried (AUTH-10.5)
                    const { maxFailedAttempts, lockoutMinutes } = signInLimiter.limits;
                    logger.warn(
                        '',
                        `Sign-in locked out for ${address} for ${lockoutMinutes} minutes after ${maxFailedAttempts} failed attempts.`,
                        context
                    );
                }
                return result;
            }

            signInLimiter.recordSuccess(address);
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

    // POST /register - Register user. Username and display name limits: AUTH-2.10
    const registerSchema = z.object({
        username: z
            .string()
            .min(1)
            .max(USERNAME_MAX_LENGTH)
            .refine(username => username.trim() === username, "Username can't start or end with a space."),
        name: z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH),
        password: z.string().min(1),
        defaultCategories: z.boolean()
    });

    router.post('/register', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'register' };
        handler.execute(req, res, op, { body: registerSchema }, async (context, { body }) => {
            const { username, name, password, defaultCategories } = body;

            const result = await controller.createUser(username, name, password, defaultCategories);
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

    // PUT /profile - Update Profile (SET-2.1): the display name; the username can't be changed
    const profileSchema = z.object({
        displayName: z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH)
    });

    router.put('/profile', middleware.requireSession, (req, res) => {
        const op: OperationDefinition = { domain, operation: 'updateProfile' };
        handler.execute(req, res, op, { body: profileSchema }, async (context, { body }) => {
            const result = await controller.updateProfile(context.user.getId(), body.displayName);
            if (result.success && result.data) {
                // GET /me answers from the session
                context.req.session.user = result.data;
            }
            return result;
        });
    });

    // POST /logout - Logout
    router.post('/logout', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'logout' };
        handler.execute(req, res, op, async context => {
            const session = context.req.session;
            if (!session) {
                return Result.success();
            }

            return new Promise<OperationResult<void>>(resolve => {
                session.destroy(err => {
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
        handler.execute(req, res, op, async context => {
            return Result.success(context.req.session.user);
        });
    });

    return router;
}
