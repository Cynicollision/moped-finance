import express from 'express';
import request from 'supertest';
import TestAgent from 'supertest/lib/agent';
import { PGlite } from '@electric-sql/pglite';
import { ApiTokenAccess } from '@shared/core/enum';
import { buildFinanceRouter } from '@server/api';
import { DatabaseClient } from '@server/data';
import { DateTimeUtil } from '@server/utility';
import { TestDatabaseUtil, TestExpressUtil } from '@server/utility/testing';
import { ApiTokenController } from './api-token-controller';
import { ApiTokenData } from './api-token-data';
import { buildApiTokenRouter } from './api-token-routes';
import { AuthController } from './auth-controller';
import { buildAuthMiddleware } from './auth-middleware';
import { buildAuthRouter } from './auth-routes';
import { SessionUtil } from './session';
import { UserData } from './user-data';

describe('API Tokens', () => {
    let app: express.Express;
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let apiTokenData: ApiTokenData;
    let agent: TestAgent;
    const logger = TestExpressUtil.createMockLogger();

    const readWrite = { name: 'Sync job', access: ApiTokenAccess.ReadWrite, expiresInDays: 90 };
    const readOnly = { name: 'Reporting', access: ApiTokenAccess.ReadOnly, expiresInDays: null };

    beforeAll(async () => {
        ({ dbClient, pglite } = await TestDatabaseUtil.createMockDatabase());
        apiTokenData = new ApiTokenData(dbClient);

        // Wired like index.ts
        const apiTokenController = new ApiTokenController(apiTokenData);
        const middleware = buildAuthMiddleware(apiTokenController);
        app = express();
        app.use(express.json());
        app.use(SessionUtil.buildMiddleware({ secret: 'test-secret', secureCookie: false, store: SessionUtil.createStore(dbClient, false) }));
        app.use('/auth/tokens', buildApiTokenRouter(logger, apiTokenController, middleware));
        app.use('/auth', buildAuthRouter(logger, new AuthController(new UserData(dbClient)), middleware, SessionUtil.cookieOptions(false)));
        app.use('/api', buildFinanceRouter(logger, dbClient, middleware));
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    beforeEach(async () => {
        await TestDatabaseUtil.clearCoreData(pglite);
        await TestDatabaseUtil.clearFinanceData(pglite);
        agent = request.agent(app);
        await agent.post('/auth/register').send({ username: 'owner', name: 'Owner', password: 'password123' });
    });

    async function createToken(body: object = readWrite): Promise<string> {
        const response = await agent.post('/auth/tokens').send(body);
        expect(response.status).toBe(201);
        return response.body.token;
    }

    describe('managing tokens', () => {
        it('AUTH-11.4 should create a token of mf_ and 43 base64url characters', async () => {
            const response = await agent.post('/auth/tokens').send(readWrite);

            expect(response.status).toBe(201);
            expect(response.body.token).toMatch(/^mf_[A-Za-z0-9_-]{43}$/);
            expect(response.body.apiToken).toMatchObject({ name: 'Sync job', access: 'ReadWrite', lastUsedAt: null });
        });

        it('AUTH-11.3 should store only a hash of the token and never return it again', async () => {
            const token = await createToken();

            const stored = await pglite.query<{ token_hash: string }>('SELECT token_hash FROM core.api_tokens');
            expect(stored.rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
            expect(stored.rows[0].token_hash).not.toContain(token);

            const list = await agent.get('/auth/tokens');
            expect(JSON.stringify(list.body)).not.toContain(token);
            expect(list.body[0]).not.toHaveProperty('token');
            expect(list.body[0]).not.toHaveProperty('tokenHash');
        });

        it('AUTH-11.1 should list tokens newest first', async () => {
            await createToken({ ...readWrite, name: 'First' });
            await createToken({ ...readWrite, name: 'Second' });

            const response = await agent.get('/auth/tokens');

            expect(response.status).toBe(200);
            expect(response.body.map((t: any) => t.name)).toEqual(['Second', 'First']);
        });

        it('AUTH-11.2 should set the expiry from the chosen expiration, or none', async () => {
            const expiring = (await agent.post('/auth/tokens').send({ ...readWrite, expiresInDays: 30 })).body.apiToken;
            const permanent = (await agent.post('/auth/tokens').send({ ...readWrite, expiresInDays: null })).body.apiToken;

            const days = (Date.parse(expiring.expiresAt) - Date.parse(expiring.createdAt)) / (24 * 60 * 60 * 1000);
            expect(days).toBeCloseTo(30, 5);
            expect(permanent.expiresAt).toBeNull();
        });

        it('AUTH-11.2 should refuse a missing or too-long name, an unknown access or an expiration not offered', async () => {
            for (const body of [
                { ...readWrite, name: '  ' },
                { ...readWrite, name: 'x'.repeat(101) },
                { ...readWrite, access: 'Admin' },
                { ...readWrite, expiresInDays: 7 },
                { name: 'No expiration given', access: ApiTokenAccess.ReadWrite }
            ]) {
                const response = await agent.post('/auth/tokens').send(body);
                expect({ body, status: response.status }).toEqual({ body, status: 400 });
            }
        });

        it('AUTH-11.5 should revoke a token, after which it no longer works', async () => {
            const token = await createToken();
            const id = (await agent.get('/auth/tokens')).body[0].id;

            expect((await agent.delete(`/auth/tokens/${id}`)).status).toBe(204);
            expect((await agent.get('/auth/tokens')).body).toEqual([]);
            expect((await request(app).get('/api/v1/institutions').set('Authorization', `Bearer ${token}`)).status).toBe(401);
        });

        it('should return 404 when revoking a token that does not exist', async () => {
            const response = await agent.delete('/auth/tokens/TOKmissing');

            expect(response.status).toBe(404);
            expect(response.body.message).toBe('API token not found.');
        });

        it('AUTH-11.9 should not let a token list, create or revoke tokens', async () => {
            const token = await createToken();
            const id = (await agent.get('/auth/tokens')).body[0].id;
            const bearer = { Authorization: `Bearer ${token}` };

            expect((await request(app).get('/auth/tokens').set(bearer)).status).toBe(401);
            expect((await request(app).post('/auth/tokens').set(bearer).send(readWrite)).status).toBe(401);
            expect((await request(app).delete(`/auth/tokens/${id}`).set(bearer)).status).toBe(401);
        });
    });

    describe('using tokens', () => {
        it('AUTH-11.6 should sign a finance API request in without creating a session', async () => {
            const token = await createToken();

            const response = await request(app).get('/api/v1/institutions').set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.headers['set-cookie']).toBeUndefined();
            const sessions = await pglite.query('SELECT sid FROM core.sessions');
            expect(sessions.rows).toHaveLength(1); // the owner's browser session from beforeEach
        });

        it('AUTH-3.4 should refuse a finance API request with neither a session nor a token', async () => {
            const response = await request(app).get('/api/v1/institutions');

            expect(response.status).toBe(401);
        });

        it('AUTH-11.7 should refuse an unknown token, even with a valid session cookie', async () => {
            for (const token of ['mf_unknown', 'not-a-token', '']) {
                const response = await agent.get('/api/v1/institutions').set('Authorization', `Bearer ${token}`);

                expect(response.status).toBe(401);
                expect(response.body.message).toBe('Invalid or expired API token.');
            }
        });

        it('AUTH-11.7 should refuse an expired token', async () => {
            const token = await createToken();
            await pglite.query('UPDATE core.api_tokens SET expires_at = $1', [DateTimeUtil.addMilliseconds(DateTimeUtil.now(), -1000)]);

            const response = await request(app).get('/api/v1/institutions').set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(401);
            expect(response.body.message).toBe('Invalid or expired API token.');
        });

        it('AUTH-11.8 should let a read-only token read but not write', async () => {
            const token = await createToken(readOnly);
            const bearer = { Authorization: `Bearer ${token}` };

            expect((await request(app).get('/api/v1/institutions').set(bearer)).status).toBe(200);

            const write = await request(app).post('/api/v1/institutions').set(bearer).send({ name: 'Bank' });
            expect(write.status).toBe(403);
            expect(write.body.message).toBe('This API token is read-only.');
            expect((await request(app).get('/api/v1/institutions').set(bearer)).body).toEqual([]);
        });

        it('AUTH-11.8 should let a read-write token write', async () => {
            const token = await createToken(readWrite);

            const response = await request(app).post('/api/v1/institutions').set('Authorization', `Bearer ${token}`).send({ name: 'Bank' });

            expect(response.status).toBe(201);
            expect(response.body.name).toBe('Bank');
        });

        it('AUTH-11.6 should accept the Bearer scheme in any case', async () => {
            const token = await createToken();

            const response = await request(app).get('/api/v1/institutions').set('Authorization', `bearer ${token}`);

            expect(response.status).toBe(200);
        });

        it('AUTH-3.5 should no longer accept HTTP Basic credentials', async () => {
            const basic = Buffer.from('owner:password123').toString('base64');

            const response = await request(app).get('/api/v1/institutions').set('Authorization', `Basic ${basic}`);

            expect(response.status).toBe(401);
        });

        it('AUTH-11.9 should ignore a token on the account endpoints', async () => {
            const token = await createToken();
            const bearer = { Authorization: `Bearer ${token}` };

            expect((await request(app).get('/auth/me').set(bearer)).body).toEqual({});
            const password = await request(app).put('/auth/password').set(bearer).send({ oldPassword: 'password123', newPassword: 'changed' });
            expect(password.status).toBe(401);
        });

        it('AUTH-11.10 should record when a token was last used, at most once a minute', async () => {
            const token = await createToken();
            const lastUsed = async () => (await agent.get('/auth/tokens')).body[0].lastUsedAt;

            await request(app).get('/api/v1/institutions').set('Authorization', `Bearer ${token}`);
            const first = await lastUsed();
            expect(first).not.toBeNull();
            expect(Math.abs(Date.parse(first) - Date.now())).toBeLessThan(60 * 1000);

            await request(app).get('/api/v1/institutions').set('Authorization', `Bearer ${token}`);
            expect(await lastUsed()).toBe(first);
        });

        it('AUTH-11.11 should keep tokens working after the password changes', async () => {
            const token = await createToken();

            const change = await agent.put('/auth/password').send({ oldPassword: 'password123', newPassword: 'changed' });
            expect(change.status).toBe(200);

            expect((await request(app).get('/api/v1/institutions').set('Authorization', `Bearer ${token}`)).status).toBe(200);
        });
    });
});
