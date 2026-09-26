import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { DatabaseClient } from '@server/data';
import { TestDatabaseUtil } from '@server/utility/testing';
import { buildHealthRouter, HealthCheckDependencies } from './health-routes';

describe('Health Routes', () => {
    let dbClient: DatabaseClient;
    let pglite: PGlite;

    beforeAll(async () => {
        const mockDb = await TestDatabaseUtil.createMockDatabase();
        dbClient = mockDb.dbClient;
        pglite = mockDb.pglite;
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    function createApp(deps: HealthCheckDependencies): express.Express {
        const app = express();
        app.use('/health', buildHealthRouter(deps));
        return app;
    }

    it('APP-5.3 should return 200 when the database is reachable', async () => {
        const app = createApp({ pingDatabase: () => dbClient.ping(), isShuttingDown: () => false });

        const response = await request(app).get('/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: 'ok' });
    });

    it('APP-5.3 should return 503 without error details when the database is unreachable', async () => {
        const app = createApp({
            pingDatabase: () => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.5:5432')),
            isShuttingDown: () => false
        });

        const response = await request(app).get('/health');

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ status: 'database-unavailable' });
    });

    it('APP-5.3 should return 503 while shutting down', async () => {
        const pingDatabase = jest.fn(() => dbClient.ping());
        const app = createApp({ pingDatabase, isShuttingDown: () => true });

        const response = await request(app).get('/health');

        expect(response.status).toBe(503);
        expect(response.body).toEqual({ status: 'shutting-down' });
        expect(pingDatabase).not.toHaveBeenCalled();
    });
});
