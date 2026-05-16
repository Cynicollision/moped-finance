import express from 'express';
import request from 'supertest';
import { AppLogger } from '@core/logger';
import { TestExpressUtil } from '@test/express-util';
import { FinanceMockUtil } from '@test/finance-mocks';
import { IFinanceBudgetStreamData } from './../data/budget-stream-data';
import { createBudgetStreamRouter } from './budget-stream-routes';

describe('Budget Stream Routes', () => {
    let app: express.Express;
    let mockBudgetStreamData: jest.Mocked<IFinanceBudgetStreamData>;
    let mockLogger: jest.Mocked<AppLogger>;

    const testUserId = 'test-user-id';

    beforeEach(() => {
        mockBudgetStreamData = FinanceMockUtil.createMockBudgetStreamData();
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createBudgetStreamRouter(mockBudgetStreamData, mockLogger);
        app = TestExpressUtil.createTestApp(router, '/budget-streams', testUserId);
    });

    xit('placeholder test for Budget Stream Routes', () => {
        // TODO: fill out tests
    });
});
