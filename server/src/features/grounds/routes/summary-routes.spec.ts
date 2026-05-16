import express from 'express';
import request from 'supertest';
import { LanguageModelGateway } from '@core/interfaces';
import { AppLogger } from '@core/logger';
import { CoreMockUtil } from '@test/core-mocks';
import { TestExpressUtil } from '@test/express-util';
import { GroundsMockUtil } from '@test/grounds-mocks';
import { createSummaryRouter } from './summary-routes';
import { IWeatherGateway } from './../gateways/weather-gateway';

describe('Summary Routes', () => {
    let app: express.Express;
    let mockLlmGateway: jest.Mocked<LanguageModelGateway>;
    let mockWeatherGateway: jest.Mocked<IWeatherGateway>;
    let mockLogger: jest.Mocked<AppLogger>;

    const testUserId = 'test-user-id';

    beforeEach(() => {
        mockLlmGateway = CoreMockUtil.createMockLlmGateway();
        mockWeatherGateway = GroundsMockUtil.createMockWeatherGateway();

        mockLogger = TestExpressUtil.createMockLogger();

        const router = createSummaryRouter(mockLlmGateway, mockWeatherGateway, mockLogger);
        app = TestExpressUtil.createTestApp(router, '/summary', testUserId);
    });

    xit('placeholder test for Summary Routes', () => {
        // TODO: fill out tests
    });
});
