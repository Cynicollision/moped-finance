import express from 'express';
import request from 'supertest';
import { AppLogger } from '@core/logger';
import { TestExpressUtil } from '@test/express-util';
import { GroundsMockUtil } from '@test/grounds-mocks';
import { createProductRouter } from './product-routes';
import { IGroundsProductData } from './../data/product-data';

describe('Product Routes', () => {
    let app: express.Express;
    let mockProductData: jest.Mocked<IGroundsProductData>;
    let mockLogger: jest.Mocked<AppLogger>;

    const testUserId = 'test-user-id';

    beforeEach(() => {
        mockProductData = GroundsMockUtil.createMockProductData();
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createProductRouter(mockProductData, mockLogger);
        app = TestExpressUtil.createTestApp(router, '/products', testUserId);
    });

    xit('placeholder test for Product Routes', () => {
        // TODO: fill out tests
    });
});
