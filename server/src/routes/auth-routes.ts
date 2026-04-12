import { Router } from 'express';
import { ApiHandler } from './api-handler';
import { resolveUser, requireAuth } from './auth-middleware';
import { BadRequestError, UnauthorizedError } from './../utility/errors';
import { AppLogger } from './../core/logger';
import { AuthController } from './../core/auth-controller';

const router = Router();

type AuthRequest = {
    username: string;
    password?: string;
    name?: string;
    oldPassword?: string;
    newPassword?: string;
};

const controller = new AuthController();
const handler = new ApiHandler(AppLogger.forPgDatabase());

router.post('/login', (req, res) => {
    handler.execute(req, res, 'login', async (context) => {
        const { username, password } = req.body as AuthRequest;
        const user = await controller.loginUser(username, password);

        if (!user) {
            throw new UnauthorizedError('Invalid username or password.');
        }

        context.req.session.user = user;
        return user;
    });
});

router.post('/register', (req, res) => {
    handler.execute(req, res, 'register', async (context) => {
        const { username, name, password } = req.body as AuthRequest;

        if (!username || !name || !password) {
            throw new BadRequestError('Username, name, and password are required.');
        }

        const user = await controller.createUser(username, name, password);

        // Auto-login after registration
        context.req.session.user = user;
        return user;
    });
});

router.put('/password', requireAuth, (req, res) => {
    handler.execute(req, res, 'changePassword', async (context) => {
        const { oldPassword, newPassword } = req.body as AuthRequest;

        if (!oldPassword || !newPassword) {
            throw new BadRequestError('Missing required fields.');
        }

        await controller.changePassword(context.userId!, oldPassword, newPassword);
    });
});

router.post('/logout', (req, res) => {
    handler.execute(req, res, 'logout', async (context) => {
        return new Promise((resolve, reject) => {
            context.req.session.destroy((err) => {
                if (err) {
                    return reject(new Error('Could not log out.'));
                }
                res.clearCookie('connect.sid');
                resolve(undefined);
            });
        });
    });
});

router.get('/me', resolveUser, (req, res) => {
    handler.execute(req, res, 'me', async (context) => {
        return context.req.session.user;
    });
});

export default router;