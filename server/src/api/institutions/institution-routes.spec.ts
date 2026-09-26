import express from 'express';
import request from 'supertest';
import { PGlite } from '@electric-sql/pglite';
import { DatabaseClient, FinanceEntityFactory } from '@server/data';
import { AppLogger } from '@server/logging';
import { TestExpressUtil, TestDatabaseUtil } from '@server/utility/testing';
import { FinanceAccountData } from './../accounts';
import { FinanceInstitutionData } from './institution-data';
import { createInstitutionRouter } from './institution-routes';
import { AccountCategory, AccountGroup, AccountType } from '@shared/finance/enum';

describe('Institution Routes', () => {
    let app: express.Express;
    let dbClient: DatabaseClient;
    let pglite: PGlite;
    let institutionsData: FinanceInstitutionData;
    let accountData: FinanceAccountData;
    let mockLogger: jest.Mocked<AppLogger>;
    let testUserId: string;

    beforeAll(async () => {
        const mockDb = await TestDatabaseUtil.createMockDatabase();
        dbClient = mockDb.dbClient;
        pglite = mockDb.pglite;

        const user = await TestDatabaseUtil.createTestUser(dbClient);
        testUserId = user.id;

        institutionsData = new FinanceInstitutionData(dbClient);
        accountData = new FinanceAccountData(dbClient);
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createInstitutionRouter(mockLogger, institutionsData, accountData);
        app = TestExpressUtil.createTestApp(router, '/institutions', testUserId);
    });

    afterAll(async () => {
        await TestDatabaseUtil.destroyMockDatabase(pglite);
    });

    beforeEach(async () => {
        await TestDatabaseUtil.clearFinanceData(pglite);
    });

    describe('GET /institutions', () => {
        it('should return a list of institutions when successful', async () => {
            const inst1 = await institutionsData.insert(FinanceEntityFactory.createInstitution({ name: 'Chase' }));
            const inst2 = await institutionsData.insert(FinanceEntityFactory.createInstitution({ name: 'Vanguard' }));

            const response = await request(app).get('/institutions');

            expect(response.status).toBe(200);
            expect(response.body.length).toBe(2);
            expect(response.body.map((i: any) => i.id)).toEqual(expect.arrayContaining([inst1.id, inst2.id]));
        });
    });

    describe('GET /institutions/:id', () => {
        it('should return a single institution when found', async () => {
            const institution = await institutionsData.insert(FinanceEntityFactory.createInstitution({ name: 'Chase' }));

            const response = await request(app).get(`/institutions/${institution.id}`);

            expect(response.status).toBe(200);
            expect(response.body.id).toBe(institution.id);
            expect(response.body.name).toBe('Chase');
        });

        it('should return 404 when institution is not found', async () => {
            const response = await request(app).get('/institutions/missing');

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
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
            expect(response.body.name).toBe('Chase');

            const inst = await institutionsData.retrieveSingle(response.body.id);
            expect(inst).not.toBeNull();
            expect(inst?.name).toBe('Chase');
        });

        it('should return 400 when schema validation fails (missing name)', async () => {
            const payload = {};

            const response = await request(app)
                .post('/institutions')
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('name:');
            expect(response.body.message).toContain('expected string');
        });
    });

    describe('PUT /institutions/:id', () => {
        it('should update an institution when input is valid', async () => {
            const institution = await institutionsData.insert(FinanceEntityFactory.createInstitution({ name: 'Old Chase' }));

            const payload = {
                name: 'Updated Chase'
            };

            const response = await request(app)
                .put(`/institutions/${institution.id}`)
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.name).toBe('Updated Chase');

            const dbInst = await institutionsData.retrieveSingle(institution.id!);
            expect(dbInst?.name).toBe('Updated Chase');
        });

        it('should return 404 when update target does not exist', async () => {
            const institutionId = 'missing-inst';
            const payload = {
                name: 'Updated Chase'
            };

            const response = await request(app)
                .put(`/institutions/${institutionId}`)
                .send(payload);

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });
    });

    describe('DELETE /institutions/:id', () => {
        it('should delete an institution', async () => {
            const institution = await institutionsData.insert(FinanceEntityFactory.createInstitution({ name: 'Chase' }));

            const response = await request(app).delete(`/institutions/${institution.id}`);

            expect(response.status).toBe(204);

            const dbInst = await institutionsData.retrieveSingle(institution.id!);
            expect(dbInst).toBeNull();
        });

        it('should return 404 when delete target does not exist', async () => {
            const institutionId = 'missing-inst';

            const response = await request(app).delete(`/institutions/${institutionId}`);

            expect(response.status).toBe(404);
            expect(response.body.message).toContain('not found');
        });

        it('should return 400 when deleting an institution with associated accounts', async () => {
            const institution = await institutionsData.insert(FinanceEntityFactory.createInstitution({ name: 'Chase' }));

            await accountData.insert(FinanceEntityFactory.createAccount({
                institutionId: institution.id,
                name: 'Checking',
                category: AccountCategory.Asset,
                group: AccountGroup.Cash,
                type: AccountType.Checking
            }));

            const response = await request(app).delete(`/institutions/${institution.id}`);

            expect(response.status).toBe(400);
            expect(response.body.message).toContain('Cannot delete institution with associated accounts');
        });
    });

    describe('POST /institutions/:id/sync', () => {
        xit('should return sync stub success', async () => {
            const institution = await institutionsData.insert(FinanceEntityFactory.createInstitution({ name: 'Chase' }));

            const response = await request(app)
                .post(`/institutions/${institution.id}/sync`);

            expect(response.status).toBe(201);
            expect(response.body.message).toContain('Sync institution logic stub');
        });
    });
});
