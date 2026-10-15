import * as bcrypt from 'bcrypt';
import express from 'express';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { PGlite } from '@electric-sql/pglite';
import { buildAuthRouter } from './auth-routes';
import { buildAuthMiddleware } from './auth-middleware';
import { DatabaseClient } from '@server/data';
import { UserData } from '@server/auth/user-data';
import { TestDatabaseUtil, TestExpressUtil } from '@server/utility/testing';
import { ApiTokenController } from './api-token-controller';
import { ApiTokenData } from './api-token-data';
import { AuthController } from './auth-controller';
import { PasswordPolicy } from './password-policy';
import { SecretData } from './secret-data';
import { SESSION_COOKIE_NAME, SessionUtil } from './session';

describe('Auth Routes', () => {
    let app: express.Express;
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let userData: UserData;
    const mockLogger = TestExpressUtil.createMockLogger();
    mockLogger.error.mockImplementation((...args: any[]) => {
        console.error('SERVER ERROR LOG:', ...args);
    });

    // Builds the app the way index.ts does, with sessions stored in the database. Each call is a fresh
    // server process as far as sessions go: only the database is shared.
    function buildApp(
        options: { secureCookie: boolean; passwordPolicy?: PasswordPolicy } = { secureCookie: false }
    ): express.Express {
        const controller = new AuthController(userData, options.passwordPolicy);
        const middleware = buildAuthMiddleware(new ApiTokenController(new ApiTokenData(dbClient)));
        const authRoutes = buildAuthRouter(
            mockLogger,
            controller,
            middleware,
            SessionUtil.cookieOptions(options.secureCookie)
        );

        const testApp = express();
        // Lets a test stand in for an HTTPS reverse proxy with X-Forwarded-Proto
        testApp.set('trust proxy', 1);
        testApp.use(express.json());
        testApp.use(
            SessionUtil.buildMiddleware({
                secret: 'test-secret',
                secureCookie: options.secureCookie,
                store: SessionUtil.createStore(dbClient, false)
            })
        );
        testApp.use('/auth', authRoutes);
        return testApp;
    }

    function sessionCookie(response: request.Response): string {
        const cookies = response.headers['set-cookie'] as unknown as string[] | undefined;
        const cookie = cookies?.find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`));
        expect(cookie).toBeDefined();
        return cookie!;
    }

    beforeAll(async () => {
        const mockDb = await TestDatabaseUtil.createMockDatabase();
        dbClient = mockDb.dbClient;
        pglite = mockDb.pglite;
        userData = new UserData(dbClient);
        app = buildApp();
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    // We will need an agent to retain session cookies between requests
    let agent: TestAgent;

    beforeEach(async () => {
        // Clear tables before each test
        await TestDatabaseUtil.clearCoreData(pglite);
        agent = request.agent(app);
    });

    describe('POST /auth/register', () => {
        it('AUTH-2.5 AUTH-2.6 should register the user and sign them in, never returning the password', async () => {
            const response = await agent.post('/auth/register').send({
                username: 'newuser',
                name: 'New User',
                password: 'correct horse battery'
            });

            if (response.status !== 200) {
                console.log('REGISTER ERROR:', response.body);
                console.log('LOGGER ERRORS:', mockLogger.error.mock.calls);
            }

            expect(response.status).toBe(200);
            expect(response.body.username).toBe('newuser');
            expect(response.body).not.toHaveProperty('passwordHash');
            expect((await agent.get('/auth/me')).body.username).toBe('newuser');

            // Verify using data layer natively
            const user = await userData.retrieveByUsername('newuser');
            expect(user).not.toBeNull();
            expect(user!.username).toBe('newuser');
        });

        it('APP-5.7 should fail if missing required fields', async () => {
            const response = await agent.post('/auth/register').send({
                username: 'missingname'
            });

            expect(response.status).toBe(400);

            const user = await userData.retrieveByUsername('missingname');
            expect(user).toBeNull();
        });

        it('AUTH-2.7 should reject registration once a user exists', async () => {
            await agent.post('/auth/register').send({
                username: 'firstuser',
                name: 'First User',
                password: 'correct horse battery'
            });

            const response = await request(app).post('/auth/register').send({
                username: 'seconduser',
                name: 'Second User',
                password: 'correct horse battery'
            });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Registration is closed.');

            const user = await userData.retrieveByUsername('seconduser');
            expect(user).toBeNull();
        });
    });

    describe('Password rules', () => {
        it('AUTH-9.4 should tell forms the minimum length', async () => {
            const response = await agent.get('/auth/password-policy');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ minLength: 12 });
        });

        it('AUTH-9.1 should use the minimum length the server is configured with', async () => {
            const strictApp = buildApp({ secureCookie: false, passwordPolicy: new PasswordPolicy(20) });

            expect((await request(strictApp).get('/auth/password-policy')).body).toEqual({ minLength: 20 });
            const response = await request(strictApp)
                .post('/auth/register')
                .send({ username: 'u', name: 'U', password: 'nineteen characters' });
            expect(response.body.message).toBe('Password must be at least 20 characters.');
        });

        it('AUTH-2.11 AUTH-9.4 should refuse to register with a password that breaks the rules, naming each one', async () => {
            const response = await agent
                .post('/auth/register')
                .send({ username: 'short', name: 'Short', password: 'short' });

            expect(response.status).toBe(400);
            expect(response.body.code).toBe('INVALID_PASSWORD');
            expect(response.body.message).toBe(
                'Password must be at least 12 characters. Password must not be the same as the username.'
            );
            expect((await agent.get('/auth/registration')).body).toEqual({ isOpen: true });
        });

        it('AUTH-5.3 should refuse a new password that breaks the rules, keeping the old one', async () => {
            await agent
                .post('/auth/register')
                .send({ username: 'changeuser1', name: 'U', password: 'correct horse battery' });

            const response = await agent
                .put('/auth/password')
                .send({ oldPassword: 'correct horse battery', newPassword: 'ChangeUser1' });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe(
                'Password must be at least 12 characters. Password must not be the same as the username.'
            );
            const login = await request(app)
                .post('/auth/login')
                .send({ username: 'changeuser1', password: 'correct horse battery' });
            expect(login.status).toBe(200);
        });

        it('AUTH-9.5 should still sign in with a password set before the rules', async () => {
            const hash = await bcrypt.hash('old', 10);
            await userData.create(
                {
                    id: 'user-old',
                    username: 'olduser',
                    displayName: 'Old',
                    createdAt: new Date(),
                    updatedAt: new Date()
                },
                hash
            );

            const response = await agent.post('/auth/login').send({ username: 'olduser', password: 'old' });

            expect(response.status).toBe(200);
        });
    });

    describe('GET /auth/registration', () => {
        it('AUTH-2.7 should report registration open when no user exists', async () => {
            const response = await agent.get('/auth/registration');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ isOpen: true });
        });

        it('AUTH-2.7 should report registration closed once a user exists', async () => {
            await agent.post('/auth/register').send({
                username: 'firstuser',
                name: 'First User',
                password: 'correct horse battery'
            });

            const response = await request(app).get('/auth/registration');

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ isOpen: false });
        });
    });

    describe('POST /auth/login', () => {
        beforeEach(async () => {
            await agent.post('/auth/register').send({
                username: 'loginuser',
                name: 'Login User',
                password: 'correct horse battery'
            });
            // We need a fresh agent to simulate an unauthenticated login attempt
            agent = request.agent(app);
        });

        it('AUTH-1.3 should sign in with valid credentials', async () => {
            const response = await agent.post('/auth/login').send({
                username: 'loginuser',
                password: 'correct horse battery'
            });

            expect(response.status).toBe(200);
            expect(response.body.username).toBe('loginuser');
            expect((await agent.get('/auth/me')).body.username).toBe('loginuser');
        });

        it('AUTH-1.4 should refuse a wrong password and an unknown username with the same message', async () => {
            const wrongPassword = await agent.post('/auth/login').send({
                username: 'loginuser',
                password: 'wrongpassword'
            });
            const unknownUser = await agent.post('/auth/login').send({
                username: 'nobody',
                password: 'correct horse battery'
            });

            expect(wrongPassword.status).toBe(400);
            expect(wrongPassword.body.message).toBe('Invalid username or password.');
            expect(unknownUser.status).toBe(400);
            expect(unknownUser.body.message).toBe('Invalid username or password.');
            expect((await agent.get('/auth/me')).body).toEqual({});
        });

        it('AUTH-1.6 should treat usernames as case-sensitive', async () => {
            const response = await agent.post('/auth/login').send({
                username: 'LoginUser',
                password: 'correct horse battery'
            });

            expect(response.status).toBe(400);
        });
    });

    describe('PUT /auth/password', () => {
        beforeEach(async () => {
            await agent.post('/auth/register').send({
                username: 'pwduser',
                name: 'Pwd User',
                password: 'old password 1234'
            });
            // We are still logged in via agent from registration
        });

        it('AUTH-5.1 should successfully change password', async () => {
            const response = await agent.put('/auth/password').send({
                oldPassword: 'old password 1234',
                newPassword: 'new password 1234'
            });

            expect(response.status).toBe(200);

            // Test logging in with new password
            const newAgent = request.agent(app);
            const loginRes = await newAgent.post('/auth/login').send({
                username: 'pwduser',
                password: 'new password 1234'
            });
            expect(loginRes.status).toBe(200);
        });

        it('AUTH-5.1 should fail to change password if old password is wrong', async () => {
            const response = await agent.put('/auth/password').send({
                oldPassword: 'wrong old password',
                newPassword: 'new password 1234'
            });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Invalid old password.');
        });
    });

    describe('PUT /auth/profile', () => {
        beforeEach(async () => {
            await agent
                .post('/auth/register')
                .send({ username: 'profileuser', name: 'Old Name', password: 'correct horse battery' });
        });

        it('SET-2.1 should change the display name, trimmed, and the session user with it', async () => {
            const response = await agent.put('/auth/profile').send({ displayName: '  New Name  ' });

            expect(response.status).toBe(200);
            expect(response.body.displayName).toBe('New Name');
            expect(response.body.username).toBe('profileuser');

            const me = await agent.get('/auth/me');
            expect(me.body.displayName).toBe('New Name');
        });

        it('SET-2.1 should ignore a username sent with the display name', async () => {
            const response = await agent.put('/auth/profile').send({ displayName: 'New Name', username: 'other' });

            expect(response.status).toBe(200);
            expect(response.body.username).toBe('profileuser');
        });

        it('SET-2.1 should refuse a blank or over-long display name', async () => {
            expect((await agent.put('/auth/profile').send({ displayName: '   ' })).status).toBe(400);
            expect((await agent.put('/auth/profile').send({ displayName: 'x'.repeat(101) })).status).toBe(400);
            expect((await agent.put('/auth/profile').send({ displayName: 'x'.repeat(100) })).status).toBe(200);
        });

        it('SET-2.1 should need a signed-in session', async () => {
            const response = await request(app).put('/auth/profile').send({ displayName: 'New Name' });

            expect(response.status).toBe(401);
        });
    });

    describe('GET /auth/me', () => {
        it('AUTH-3.1 should return user profile when logged in', async () => {
            await agent.post('/auth/register').send({
                username: 'meuser',
                name: 'Me User',
                password: 'correct horse battery'
            });

            const response = await agent.get('/auth/me');
            expect(response.status).toBe(200);
            expect(response.body.username).toBe('meuser');
        });

        it('AUTH-3.1 should return an empty profile when not logged in', async () => {
            const response = await agent.get('/auth/me');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({});
        });
    });

    describe('POST /auth/logout', () => {
        it('AUTH-4.1 should end the session', async () => {
            // Register auto-logs in
            const loginResponse = await agent.post('/auth/register').send({
                username: 'logoutuser',
                name: 'Logout User',
                password: 'correct horse battery'
            });
            expect(loginResponse.status).toBe(200);

            const meResponse = await agent.get('/auth/me');
            expect(meResponse.body.username).toBe('logoutuser');

            const logoutResponse = await agent.post('/auth/logout');
            expect(logoutResponse.status).toBe(200);

            const checkMeResponse = await agent.get('/auth/me');
            expect(checkMeResponse.body).toEqual({});
        });

        it('AUTH-3.8 should clear the cookie with the attributes it was set with', async () => {
            const registerResponse = await agent
                .post('/auth/register')
                .send({ username: 'u', name: 'U', password: 'long enough password' });
            const logoutResponse = await agent.post('/auth/logout');

            const cleared = sessionCookie(logoutResponse);
            expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
            const attributes = (cookie: string) =>
                cookie
                    .split('; ')
                    .filter(a => /^(Path|HttpOnly|Secure|SameSite)/.test(a))
                    .sort();
            expect(attributes(cleared)).toEqual(attributes(sessionCookie(registerResponse)));
        });

        it('AUTH-3.8 should clear a secure cookie with Secure behind an HTTPS proxy', async () => {
            const httpsAgent = request.agent(buildApp({ secureCookie: true }));
            const registerResponse = await httpsAgent
                .post('/auth/register')
                .set('X-Forwarded-Proto', 'https')
                .send({ username: 'u', name: 'U', password: 'long enough password' });
            expect(sessionCookie(registerResponse)).toContain('; Secure');

            const logoutResponse = await httpsAgent.post('/auth/logout').set('X-Forwarded-Proto', 'https');
            expect(sessionCookie(logoutResponse)).toContain('; Secure');
        });
    });

    describe('Sessions', () => {
        it('AUTH-3.8 should set an HTTP-only, SameSite=Lax session cookie without Secure over plain HTTP', async () => {
            const response = await agent
                .post('/auth/register')
                .send({ username: 'u', name: 'U', password: 'long enough password' });

            const cookie = sessionCookie(response);
            expect(cookie).toContain('; HttpOnly');
            expect(cookie).toContain('; SameSite=Lax');
            expect(cookie).not.toContain('; Secure');
        });

        it('AUTH-3.2 should restart the 24 hours on every request', async () => {
            await agent.post('/auth/register').send({ username: 'u', name: 'U', password: 'long enough password' });
            const response = await agent.get('/auth/me');

            // The cookie is sent again with a new expiry, and the stored session is extended to match
            const expires = Date.parse(sessionCookie(response).match(/Expires=([^;]+)/)![1]);
            expect(Math.abs(expires - (Date.now() + 24 * 60 * 60 * 1000))).toBeLessThan(60 * 1000);
            const rows = await pglite.query<{ hours: number }>(
                'SELECT EXTRACT(EPOCH FROM expire - now()) / 3600 AS hours FROM core.sessions'
            );
            expect(rows.rows).toHaveLength(1);
            expect(Number(rows.rows[0].hours)).toBeCloseTo(24, 1);
        });

        it('AUTH-3.6 should keep the user signed in across a server restart', async () => {
            await agent
                .post('/auth/register')
                .send({ username: 'restartuser', name: 'U', password: 'long enough password' });

            // The same browser, now talking to a newly started server
            const restartedAgent = request.agent(buildApp());
            const cookie = (await agent.get('/auth/me')).headers['set-cookie'] as unknown as string[];
            const response = await restartedAgent.get('/auth/me').set(
                'Cookie',
                cookie.map(c => c.split(';')[0])
            );

            expect(response.body.username).toBe('restartuser');
        });

        it('AUTH-3.7 should generate a session secret once and return the same one afterwards', async () => {
            const secretData = new SecretData(dbClient);

            const first = await secretData.retrieveOrCreate('session');
            const second = await secretData.retrieveOrCreate('session');
            const other = await secretData.retrieveOrCreate('other');

            expect(first).toHaveLength(43); // 32 random bytes, base64url
            expect(second).toBe(first);
            expect(other).not.toBe(first);
        });
    });
});
