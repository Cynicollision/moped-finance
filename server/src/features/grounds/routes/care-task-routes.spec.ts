import express from 'express';
import request from 'supertest';
import { AppLogger } from '@core/logger';
import { TestExpressUtil } from '@test/express-util';
import { GroundsMockUtil } from '@test/grounds-mocks';
import { createCareTaskRouter } from './care-task-routes';
import { IGroundsCareTaskData } from './../data/care-task-data';

describe('Care Task Routes', () => {
    let app: express.Express;
    let mockCareTaskData: jest.Mocked<IGroundsCareTaskData>;
    let mockLogger: jest.Mocked<AppLogger>;

    const testUserId = 'test-user-id';

    beforeEach(() => {
        mockCareTaskData = GroundsMockUtil.createMockCareTaskData();
        mockLogger = TestExpressUtil.createMockLogger();

        const router = createCareTaskRouter(mockCareTaskData, mockLogger);
        app = TestExpressUtil.createTestApp(router, '/tasks', testUserId);
    });

    xit('placeholder test for Care Task Routes', () => {
        // TODO: fill out tests
    });
});
