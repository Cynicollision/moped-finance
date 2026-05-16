import { IGroundsCareTaskData } from './../features/grounds/data/care-task-data';
import { IGroundsLocationData } from './../features/grounds/data/location-data';
import { IGroundsPlantData } from './../features/grounds/data/plant-data';
import { IGroundsPlantVarietyData } from './../features/grounds/data/plant-variety-data';
import { IGroundsProductData } from './../features/grounds/data/product-data';
import { IWeatherGateway } from './../features/grounds/gateways/weather-gateway';

export class GroundsMockUtil {
    public static createMockCareTaskData(): jest.Mocked<IGroundsCareTaskData> {
        return {
            retrieveAll: jest.fn(),
            retrieveSingle: jest.fn(),
            insert: jest.fn(),
            update: jest.fn()
        };
    }

    public static createMockLocationData(): jest.Mocked<IGroundsLocationData> {
        return {
            retrieveAll: jest.fn(),
            retrieveSingle: jest.fn(),
        };
    }

    public static createMockPlantData(): jest.Mocked<IGroundsPlantData> {
        return {
            retrieveAll: jest.fn(),
            retrieveSingle: jest.fn(),
            retrieveByVariety: jest.fn(),
            insert: jest.fn(),
            delete: jest.fn()
        };
    }

    public static createMockPlantVarietyData(): jest.Mocked<IGroundsPlantVarietyData> {
        return {
            retrieveAll: jest.fn(),
            retrieveSingle: jest.fn(),
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        };
    }

    public static createMockProductData(): jest.Mocked<IGroundsProductData> {
        return {
            retrieveAll: jest.fn(),
            retrieveSingle: jest.fn(),
            insert: jest.fn(),
            update: jest.fn(),
            delete: jest.fn()
        };
    }

    public static createMockWeatherGateway(): jest.Mocked<IWeatherGateway> {
        return {
            getForecast: jest.fn(),
            getHourlyForecast: jest.fn()
        };
    }
}
