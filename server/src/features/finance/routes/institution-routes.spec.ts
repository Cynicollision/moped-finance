import express from 'express';
import request from 'supertest';
import { AppLogger } from '@core/logger';
import { TestExpressUtil } from '@test/express-util';
import { FinanceMockUtil } from '@test/finance-mocks';
import { IFinanceInstitutionsData } from './../data/institutions-data';
import { createInstitutionRouter } from './institution-routes';

describe('Institution Routes', () => {
    let app: express.Express;
    let mockInstitutionsData: jest.Mocked<IFinanceInstitutionsData>;
    let mockLogger: jest.Mocked<AppLogger>;

    const testUserId = 'test-user-id';

    beforeEach(() => {
        mockInstitutionsData = FinanceMockUtil.createMockInstitutionsData();
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createInstitutionRouter(mockInstitutionsData, mockLogger);
        app = TestExpressUtil.createTestApp(router, '/institutions', testUserId);
    });

    xit('placeholder test for Institution Routes', () => {
        // TODO: fill out tests
    });
});
