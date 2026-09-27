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
    function buildApp(options: { secureCookie: boolean } = { secureCookie: false }): express.Express {
        const controller = new AuthController(userData);
        const middleware = buildAuthMiddleware(new ApiTokenController(new ApiTokenData(dbClient)));
        const authRoutes = buildAuthRouter(mockLogger, controller, middleware, SessionUtil.cookieOptions(options.secureCookie));

        const testApp = express();
        // Lets a test stand in for an HTTPS reverse proxy with X-Forwarded-Proto
        testApp.set('trust proxy', 1);
        testApp.use(express.json());
        testApp.use(SessionUtil.buildMiddleware({
            secret: 'test-secret',
            secureCookie: options.secureCookie,
            store: SessionUtil.createStore(dbClient, false)
        }));
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
        it('should register a new user successfully', async () => {
            const response = await agent.post('/auth/register').send({
                username: 'newuser',
                name: 'New User',
                password: 'password123'
            });

            if (response.status !== 200) {
                console.log('REGISTER ERROR:', response.body);
                console.log('LOGGER ERRORS:', mockLogger.error.mock.calls);
            }

            expect(response.status).toBe(200);
            expect(response.body.username).toBe('newuser');

            // Verify using data layer natively
            const user = await userData.retrieveByUsername('newuser');
            expect(user).not.toBeNull();
            expect(user!.username).toBe('newuser');
        });

        it('should fail if missing required fields', async () => {
            const response = await agent.post('/auth/register').send({
                username: 'missingname'
            });

            expect(response.status).toBe(400);

            const user = await userData.retrieveByUsername('newuser');
            expect(user).toBeNull();
        });

        it('AUTH-2.7 should reject registration once a user exists', async () => {
            await agent.post('/auth/register').send({
                username: 'firstuser',
                name: 'First User',
                password: 'password123'
            });

            const response = await request(app).post('/auth/register').send({
                username: 'seconduser',
                name: 'Second User',
                password: 'password123'
            });

            expect(response.status).toBe(400);
            expect(response.body.message).toBe('Registration is closed.');

            const user = await userData.retrieveByUsername('seconduser');
            expect(user).toBeNull();
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
                password: 'password123'
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
                password: 'password123'
            });
            // We need a fresh agent to simulate an unauthenticated login attempt
            agent = request.agent(app);
        });

        it('should login successfully with valid credentials', async () => {
            const response = await agent.post('/auth/login').send({
                username: 'loginuser',
                password: 'password123'
            });

            expect(response.status).toBe(200);
            expect(response.body.username).toBe('loginuser');
        });

        it('should fail login with invalid password', async () => {
            const response = await agent.post('/auth/login').send({
                username: 'loginuser',
                password: 'wrongpassword'
            });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Invalid');
        });
    });

    describe('PUT /auth/password', () => {
        beforeEach(async () => {
            await agent.post('/auth/register').send({
                username: 'pwduser',
                name: 'Pwd User',
                password: 'oldpassword'
            });
            // We are still logged in via agent from registration
        });

        it('should successfully change password', async () => {
            const response = await agent.put('/auth/password').send({
                oldPassword: 'oldpassword',
                newPassword: 'newpassword'
            });

            expect(response.status).toBe(200);

            // Test logging in with new password
            const newAgent = request.agent(app);
            const loginRes = await newAgent.post('/auth/login').send({
                username: 'pwduser',
                password: 'newpassword'
            });
            expect(loginRes.status).toBe(200);
        });

        it('should fail to change password if old password is wrong', async () => {
            const response = await agent.put('/auth/password').send({
                oldPassword: 'wrongoldpassword',
                newPassword: 'newpassword'
            });

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Invalid');
        });
    });

    describe('GET /auth/me', () => {
        it('should return user profile when logged in', async () => {
            await agent.post('/auth/register').send({
                username: 'meuser',
                name: 'Me User',
                password: 'password123'
            });

            const response = await agent.get('/auth/me');
            expect(response.status).toBe(200);
            expect(response.body.username).toBe('meuser');
        });

        it('should return null or not authenticated when not logged in', async () => {
            const response = await agent.get('/auth/me');
            expect(response.status).toBe(200);
            expect(response.body).toEqual({});
        });
    });

    describe('POST /auth/logout', () => {
        it('should clear session successfully', async () => {
            // Register auto-logs in
            const loginResponse = await agent.post('/auth/register').send({
                username: 'logoutuser',
                name: 'Logout User',
                password: 'password123'
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
            const registerResponse = await agent.post('/auth/register').send({ username: 'u', name: 'U', password: 'p' });
            const logoutResponse = await agent.post('/auth/logout');

            const cleared = sessionCookie(logoutResponse);
            expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
            const attributes = (cookie: string) => cookie.split('; ').filter(a => /^(Path|HttpOnly|Secure|SameSite)/.test(a)).sort();
            expect(attributes(cleared)).toEqual(attributes(sessionCookie(registerResponse)));
        });

        it('AUTH-3.8 should clear a secure cookie with Secure behind an HTTPS proxy', async () => {
            const httpsAgent = request.agent(buildApp({ secureCookie: true }));
            const registerResponse = await httpsAgent.post('/auth/register')
                .set('X-Forwarded-Proto', 'https')
                .send({ username: 'u', name: 'U', password: 'p' });
            expect(sessionCookie(registerResponse)).toContain('; Secure');

            const logoutResponse = await httpsAgent.post('/auth/logout').set('X-Forwarded-Proto', 'https');
            expect(sessionCookie(logoutResponse)).toContain('; Secure');
        });
    });

    describe('Sessions', () => {
        it('AUTH-3.8 should set an HTTP-only, SameSite=Lax session cookie without Secure over plain HTTP', async () => {
            const response = await agent.post('/auth/register').send({ username: 'u', name: 'U', password: 'p' });

            const cookie = sessionCookie(response);
            expect(cookie).toContain('; HttpOnly');
            expect(cookie).toContain('; SameSite=Lax');
            expect(cookie).not.toContain('; Secure');
        });

        it('AUTH-3.2 should restart the 24 hours on every request', async () => {
            await agent.post('/auth/register').send({ username: 'u', name: 'U', password: 'p' });
            const response = await agent.get('/auth/me');

            // The cookie is sent again with a new expiry, and the stored session is extended to match
            const expires = Date.parse(sessionCookie(response).match(/Expires=([^;]+)/)![1]);
            expect(Math.abs(expires - (Date.now() + 24 * 60 * 60 * 1000))).toBeLessThan(60 * 1000);
            const rows = await pglite.query<{ hours: number }>('SELECT EXTRACT(EPOCH FROM expire - now()) / 3600 AS hours FROM core.sessions');
            expect(rows.rows).toHaveLength(1);
            expect(Number(rows.rows[0].hours)).toBeCloseTo(24, 1);
        });

        it('AUTH-3.6 should keep the user signed in across a server restart', async () => {
            await agent.post('/auth/register').send({ username: 'restartuser', name: 'U', password: 'p' });

            // The same browser, now talking to a newly started server
            const restartedAgent = request.agent(buildApp());
            const cookie = (await agent.get('/auth/me')).headers['set-cookie'] as unknown as string[];
            const response = await restartedAgent.get('/auth/me').set('Cookie', cookie.map(c => c.split(';')[0]));

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
