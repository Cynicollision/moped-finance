import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { AppLogger } from '@server-core/logger';
import { DatabaseClient } from '@server-core/database';
import { TestExpressUtil, TestDatabaseUtil } from '@server-core/utility/testing';
import { FinanceEntityFactory } from './../common';
import { FinanceInstitutionData } from './institution-data';
import { createInstitutionRouter } from './institution-routes';

describe('Institution Routes', () => {
    let app: express.Express;
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let institutionsData: FinanceInstitutionData;
    let mockLogger: jest.Mocked<AppLogger>;
    let testUserId: string;

    beforeAll(async () => {
        const mockDb = await TestDatabaseUtil.createMockDatabase();
        dbClient = mockDb.dbClient;
        pglite = mockDb.pglite;

        const user = await TestDatabaseUtil.createTestUser(dbClient);
        testUserId = user.id;

        institutionsData = new FinanceInstitutionData(dbClient);
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createInstitutionRouter(mockLogger, institutionsData);
        app = TestExpressUtil.createTestApp(router, '/institutions', testUserId);
    });

    afterAll(async () => {
        if (pglite) {
            await pglite.close();
        }
    });

    beforeEach(async () => {
        await pglite.exec('TRUNCATE finance.institutions CASCADE;');
    });

    describe('GET /institutions', () => {
        it('should return a list of institutions when successful', async () => {
            const inst1 = await institutionsData.insert(FinanceEntityFactory.createInstitution(testUserId, { name: 'Chase' }));
            const inst2 = await institutionsData.insert(FinanceEntityFactory.createInstitution(testUserId, { name: 'Vanguard' }));

            const response = await request(app).get('/institutions');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.length).toBe(2);
            expect(response.body.data.map((i: any) => i.id)).toEqual(expect.arrayContaining([inst1.id, inst2.id]));
        });
    });

    describe('GET /institutions/:id', () => {
        it('should return a single institution when found', async () => {
            const institution = await institutionsData.insert(FinanceEntityFactory.createInstitution(testUserId, { name: 'Chase' }));

            const response = await request(app).get(`/institutions/${institution.id}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.id).toBe(institution.id);
            expect(response.body.data.name).toBe('Chase');
        });

        it('should return 400 when institution is not found', async () => {
            const response = await request(app).get('/institutions/missing');

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found');
        });
    });

    describe('POST /institutions', () => {
        it('should create a new institution', async () => {
            const payload = {
                name: 'Chase'
            };

            const response = await request(app)
                .post('/institutions')
                .send(payload);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('Chase');

            const inst = await institutionsData.retrieveSingle(response.body.data.id);
            expect(inst).not.toBeNull();
            expect(inst?.name).toBe('Chase');
        });

        it('should return 400 when schema validation fails (missing name)', async () => {
            const payload = {};

            const response = await request(app)
                .post('/institutions')
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('name:');
            expect(response.body.error.message).toContain('expected string');
        });
    });

    describe('PUT /institutions/:id', () => {
        it('should update an institution when input is valid and resource belongs to user', async () => {
            const institution = await institutionsData.insert(FinanceEntityFactory.createInstitution(testUserId, { name: 'Old Chase' }));

            const payload = {
                name: 'Updated Chase'
            };

            const response = await request(app)
                .put(`/institutions/${institution.id}`)
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data.name).toBe('Updated Chase');

            const dbInst = await institutionsData.retrieveSingle(institution.id!);
            expect(dbInst?.name).toBe('Updated Chase');
        });

        it('should return 400 when update fails because resource does not exist or user lacks ownership', async () => {
            const institutionId = 'unowned-inst';
            const payload = {
                name: 'Updated Chase'
            };

            const response = await request(app)
                .put(`/institutions/${institutionId}`)
                .send(payload);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found or access denied');
        });
    });

    describe('DELETE /institutions/:id', () => {
        it('should delete an institution when resource belongs to user', async () => {
            const institution = await institutionsData.insert(FinanceEntityFactory.createInstitution(testUserId, { name: 'Chase' }));

            const response = await request(app).delete(`/institutions/${institution.id}`);

            expect(response.status).toBe(204);

            const dbInst = await institutionsData.retrieveSingle(institution.id!);
            expect(dbInst).toBeNull();
        });

        it('should return 400 when delete fails because resource does not exist or user lacks ownership', async () => {
            const institutionId = 'unowned-inst';

            const response = await request(app).delete(`/institutions/${institutionId}`);

            expect(response.status).toBe(404);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found or access denied');
        });
    });

    describe('POST /institutions/:id/sync', () => {
        xit('should return sync stub success', async () => {
            const institution = await institutionsData.insert(FinanceEntityFactory.createInstitution(testUserId, { name: 'Chase' }));

            const response = await request(app)
                .post(`/institutions/${institution.id}/sync`);

            expect(response.status).toBe(201);
            expect(response.body.success).toBe(true);
            expect(response.body.data.message).toContain('Sync institution logic stub');
        });
    });
});
