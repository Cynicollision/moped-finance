import { Router } from 'express';
import { GeminiGateway } from '@core/gateways/gemini-gateway';
import { LanguageModelGateway, IDatabaseClient } from '@core/interfaces';
import { AppLogger } from '@core/logger';
import { WeatherGateway, IWeatherGateway } from './../gateways/weather-gateway';
import { GroundsData, IGroundsData } from './../data';
import { createSummaryRouter } from './summary-routes';
import { createLocationRouter } from './location-routes';
import { createPlantRouter } from './plant-routes';
import { createPlantVarietyRouter } from './plant-variety-routes';
import { createProductRouter } from './product-routes';
import { createCareTaskRouter } from './care-task-routes';
import { PlantController } from './../controllers/plant-controller';

export function createGroundsRouter(
    groundsData: IGroundsData,
    llmGateway: LanguageModelGateway,
    weatherGateway: IWeatherGateway,
    logger: AppLogger
) {
    const router = Router();

    // The plant controllers are shared between the two plant routes
    const plantController = new PlantController(logger, groundsData.plants, groundsData.plantVarieties);

    router.use('/summary', createSummaryRouter(llmGateway, weatherGateway, logger));
    router.use('/data/locations', createLocationRouter(groundsData.locations, logger));
    router.use('/data/plants', createPlantRouter(plantController, logger));
    router.use('/data/plant-varieties', createPlantVarietyRouter(plantController, logger));
    router.use('/data/products', createProductRouter(groundsData.products, logger));
    router.use('/data/tasks', createCareTaskRouter(groundsData.careTasks, logger));

    return router;
}

export function createGroundsModule(
    db: IDatabaseClient,
    logger: AppLogger,
    llmGateway: LanguageModelGateway,
    weatherGateway: IWeatherGateway
) {
    return createGroundsRouter(
        GroundsData.forPgDatabase(db),
        llmGateway,
        weatherGateway,
        logger
    );
}
