import express from 'express';
import request from 'supertest';
import { AppLogger } from '@core/logger';
import { TestExpressUtil } from '@test/express-util';
import { FinanceMockUtil } from '@test/finance-mocks';
import { IFinanceCategoriesData } from './../data/categories-data';
import { createCategoryRouter } from './category-routes';

describe('Category Routes', () => {
    let app: express.Express;
    let mockCategoriesData: jest.Mocked<IFinanceCategoriesData>;
    let mockLogger: jest.Mocked<AppLogger>;

    const testUserId = 'test-user-id';

    beforeEach(() => {
        mockCategoriesData = FinanceMockUtil.createMockCategoriesData();
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createCategoryRouter(mockCategoriesData, mockLogger);
        app = TestExpressUtil.createTestApp(router, '/categories', testUserId);
    });

    xit('placeholder test for Category Routes', () => {
        // TODO: fill out tests
    });
});
