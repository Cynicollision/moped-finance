import express from 'express';
import request from 'supertest';
import { Institution } from '@shared/finance/types';
import { AppLogger } from '@core/logger';
import { DateTimeUtil } from '@core/utility';
import { TestExpressUtil } from '@test/express-util';
import { FinanceMockUtil } from '@test/finance-mocks';
import { IFinanceInstitutionsData } from './institutions-data';
import { createInstitutionRouter } from './institution-routes';

describe('Institution Routes', () => {
    let app: express.Express;
    let mockInstitutionsData: jest.Mocked<IFinanceInstitutionsData>;
    let mockLogger: jest.Mocked<AppLogger>;

    const testUserId = 'test-user-id';

    const createMockInstitution = (overrides?: Partial<Institution>): Institution => {
        return {
            id: 'inst1',
            userId: testUserId,
            name: 'Chase Bank',
            createdAt: DateTimeUtil.now(),
            updatedAt: DateTimeUtil.now(),
            ...overrides
        } as Institution;
    };

    beforeEach(() => {
        mockInstitutionsData = FinanceMockUtil.createMockInstitutionsData();
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createInstitutionRouter(mockInstitutionsData, mockLogger);
        app = TestExpressUtil.createTestApp(router, '/institutions', testUserId);
    });

    describe('GET /institutions', () => {
        it('should return a list of institutions when successful', async () => {
            const mockInstitutions = [
                createMockInstitution({ id: 'inst1', name: 'Chase' }),
                createMockInstitution({ id: 'inst2', name: 'Vanguard' })
            ];
            mockInstitutionsData.retrieveAll.mockResolvedValue(mockInstitutions);

            const response = await request(app).get('/institutions');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(mockInstitutions)));
            expect(mockInstitutionsData.retrieveAll).toHaveBeenCalledWith(testUserId);
        });
    });

    describe('GET /institutions/:id', () => {
        it('should return a single institution when found', async () => {
            const mockInstitution = createMockInstitution({ id: 'inst1', name: 'Chase' });
            mockInstitutionsData.retrieveSingle.mockResolvedValue(mockInstitution);

            const response = await request(app).get('/institutions/inst1');

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(mockInstitution)));
            expect(mockInstitutionsData.retrieveSingle).toHaveBeenCalledWith(testUserId, 'inst1');
        });

        it('should return 400 when institution is not found', async () => {
            mockInstitutionsData.retrieveSingle.mockResolvedValue(null);

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
            const createdInstitution = createMockInstitution({ ...payload, id: 'new-inst-id' });
            mockInstitutionsData.insert.mockResolvedValue(createdInstitution);

            const response = await request(app)
                .post('/institutions')
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(createdInstitution)));
            expect(mockInstitutionsData.insert).toHaveBeenCalledWith(testUserId, expect.objectContaining(payload));
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
            expect(mockInstitutionsData.insert).not.toHaveBeenCalled();
        });
    });

    describe('PUT /institutions/:id', () => {
        it('should update an institution when input is valid and resource belongs to user', async () => {
            const institutionId = 'inst1';
            const payload = {
                name: 'Updated Chase'
            };
            const updatedInstitution = createMockInstitution({ ...payload, id: institutionId });
            mockInstitutionsData.update.mockResolvedValue(updatedInstitution);

            const response = await request(app)
                .put(`/institutions/${institutionId}`)
                .send(payload);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.data).toEqual(JSON.parse(JSON.stringify(updatedInstitution)));
            expect(mockInstitutionsData.update).toHaveBeenCalledWith(
                testUserId,
                expect.objectContaining({ ...payload, id: institutionId })
            );
        });

        it('should return 400 when update fails because resource does not exist or user lacks ownership', async () => {
            const institutionId = 'unowned-inst';
            const payload = {
                name: 'Updated Chase'
            };
            mockInstitutionsData.update.mockResolvedValue(null as any);

            const response = await request(app)
                .put(`/institutions/${institutionId}`)
                .send(payload);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found or access denied');
        });
    });

    describe('DELETE /institutions/:id', () => {
        it('should delete an institution when resource belongs to user', async () => {
            const institutionId = 'inst1';
            mockInstitutionsData.delete.mockResolvedValue(true);

            const response = await request(app).delete(`/institutions/${institutionId}`);

            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(mockInstitutionsData.delete).toHaveBeenCalledWith(testUserId, institutionId);
        });

        it('should return 400 when delete fails because resource does not exist or user lacks ownership', async () => {
            const institutionId = 'unowned-inst';
            mockInstitutionsData.delete.mockResolvedValue(false);

            const response = await request(app).delete(`/institutions/${institutionId}`);

            expect(response.status).toBe(400);
            expect(response.body.success).toBe(false);
            expect(response.body.error.message).toContain('not found or access denied');
        });
    });
});
