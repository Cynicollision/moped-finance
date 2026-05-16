import express from 'express';
import request from 'supertest';
import { AppLogger } from '@core/logger';
import { TestExpressUtil } from '@test/express-util';
import { GroundsMockUtil } from '@test/grounds-mocks';
import { createPlantRouter } from './plant-routes';
import { IGroundsPlantData } from './../data/plant-data';
import { IGroundsPlantVarietyData } from './../data/plant-variety-data';
import { PlantController } from './../controllers/plant-controller';

describe('Plant Routes', () => {
    let app: express.Express;
    let mockPlantData: jest.Mocked<IGroundsPlantData>;
    let mockPlantVarietyData: jest.Mocked<IGroundsPlantVarietyData>;
    let mockLogger: jest.Mocked<AppLogger>;
    let controller: PlantController;

    const testUserId = 'test-user-id';

    beforeEach(() => {
        mockPlantData = GroundsMockUtil.createMockPlantData();
        mockPlantVarietyData = GroundsMockUtil.createMockPlantVarietyData();
        mockLogger = TestExpressUtil.createMockLogger();

        controller = new PlantController(mockLogger, mockPlantData, mockPlantVarietyData);
        const router = createPlantRouter(controller, mockLogger);
        app = TestExpressUtil.createTestApp(router, '/plants', testUserId);
    });

    xit('placeholder test for Plant Routes', () => {
        // TODO: fill out tests
    });
});
