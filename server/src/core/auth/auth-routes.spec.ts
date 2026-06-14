import express from 'express';
import request from 'supertest';
import session from 'express-session';
import TestAgent from 'supertest/lib/agent';
import { PGlite } from '@electric-sql/pglite';
import { createAuthRouter } from './auth-routes';
import { createAuthMiddleware } from './auth-middleware';
import { DatabaseClient } from '@server-core/db-client';
import { CoreUserData } from '@server-core/data/user-data';
import { TestDatabaseUtil, TestExpressUtil } from '@server-core/utility/testing';

describe('Auth Routes', () => {
    let app: express.Express;
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let userData: CoreUserData;
    const mockLogger = TestExpressUtil.createMockLogger();
    mockLogger.error.mockImplementation((...args: any[]) => {
        console.error('SERVER ERROR LOG:', ...args);
    });

    beforeAll(async () => {
        const mockDb = await TestDatabaseUtil.createMockDatabase();
        dbClient = mockDb.dbClient;
        pglite = mockDb.pglite;
        userData = new CoreUserData(dbClient);

        const { resolveUser, requireAuth } = createAuthMiddleware(userData);
        const authRoutes = createAuthRouter(userData, mockLogger, requireAuth, resolveUser);

        app = express();
        app.use(express.json());
        app.use(session({
            secret: 'test-secret',
            resave: false,
            saveUninitialized: false
        }));

        // Expose resolveUser middleware for testing /me globally
        app.use(resolveUser);
        app.use('/auth', authRoutes);
    });

    afterAll(async () => {
        if (pglite) {
            await pglite.close();
        }
    });

    // We will need an agent to retain session cookies between requests
    let agent: TestAgent;

    beforeEach(async () => {
        // Clear tables before each test
        await pglite.exec('DELETE FROM core.users');
        agent = request.agent(app);
    });

    it('debug db client', async () => {
        try {
            const user = await userData.retrieveByUsername('newuser');
            console.log('User:', user);
        } catch (err: any) {
            console.error('DB ERROR:', err, err.cause);
        }
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
            expect(response.body.success).toBe(true);
            expect(response.body.data.username).toBe('newuser');

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
            expect(response.body.success).toBe(false);

            const user = await userData.retrieveByUsername('newuser');
            expect(user).toBeNull();
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
            expect(response.body.success).toBe(true);
            expect(response.body.data.username).toBe('loginuser');
        });

        it('should fail login with invalid password', async () => {
            const response = await agent.post('/auth/login').send({
                username: 'loginuser',
                password: 'wrongpassword'
            });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('Invalid');
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
            expect(response.body.success).toBe(true);

            // Test logging in with new password
            const newAgent = request.agent(app);
            const loginRes = await newAgent.post('/auth/login').send({
                username: 'pwduser',
                password: 'newpassword'
            });
            expect(loginRes.status).toBe(200);
            expect(loginRes.body.success).toBe(true);
        });

        it('should fail to change password if old password is wrong', async () => {
            const response = await agent.put('/auth/password').send({
                oldPassword: 'wrongoldpassword',
                newPassword: 'newpassword'
            });

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('Invalid');
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
            expect(response.body.success).toBe(true);
            expect(response.body.data.username).toBe('meuser');
        });

        it('should return null or not authenticated when not logged in', async () => {
            const response = await agent.get('/auth/me');
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toBeUndefined();
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
            expect(meResponse.body.data.username).toBe('logoutuser');

            const logoutResponse = await agent.post('/auth/logout');
            expect(logoutResponse.status).toBe(200);

            const checkMeResponse = await agent.get('/auth/me');
            expect(checkMeResponse.body.data).toBeUndefined();
        });
    });
});
