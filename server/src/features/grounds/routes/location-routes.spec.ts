import express from 'express';
import request from 'supertest';
import { AppLogger } from '@core/logger';
import { TestExpressUtil } from '@test/express-util';
import { GroundsMockUtil } from '@test/grounds-mocks';
import { createLocationRouter } from './location-routes';
import { IGroundsLocationData } from './../data/location-data';

describe('Location Routes', () => {
    let app: express.Express;
    let mockLocationData: jest.Mocked<IGroundsLocationData>;
    let mockLogger: jest.Mocked<AppLogger>;

    const testUserId = 'test-user-id';

    beforeEach(() => {
        mockLocationData = GroundsMockUtil.createMockLocationData();
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createLocationRouter(mockLocationData, mockLogger);
        app = TestExpressUtil.createTestApp(router, '/locations', testUserId);
    });

    xit('placeholder test for Location Routes', () => {
        // TODO: fill out tests
    });
});
