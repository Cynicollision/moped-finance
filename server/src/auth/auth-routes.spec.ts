import express from 'express';
import request from 'supertest';
import session from 'express-session';
import TestAgent from 'supertest/lib/agent';
import { PGlite } from '@electric-sql/pglite';
import { buildAuthRouter } from './auth-routes';
import { buildAuthMiddleware } from './auth-middleware';
import { DatabaseClient } from '@server/data';
import { UserData } from '@server/auth/user-data';
import { TestDatabaseUtil, TestExpressUtil } from '@server/utility/testing';
import { AuthController } from './auth-controller';

describe('Auth Routes', () => {
    let app: express.Express;
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let userData: UserData;
    const mockLogger = TestExpressUtil.createMockLogger();
    mockLogger.error.mockImplementation((...args: any[]) => {
        console.error('SERVER ERROR LOG:', ...args);
    });

    beforeAll(async () => {
        const mockDb = await TestDatabaseUtil.createMockDatabase();
        dbClient = mockDb.dbClient;
        pglite = mockDb.pglite;
        userData = new UserData(dbClient);

        const controller = new AuthController(userData)
        const middleware = buildAuthMiddleware(controller);
        const authRoutes = buildAuthRouter(mockLogger, controller, middleware);

        app = express();
        app.use(express.json());
        app.use(session({
            secret: 'test-secret',
            resave: false,
            saveUninitialized: false
        }));

        // Expose resolveUser middleware for testing /me globally
        app.use(middleware.resolveUser);
        app.use('/auth', authRoutes);
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
    });
});
