import { Router } from 'express';
import { ApiHandler } from '@core/api-handler';
import { LanguageModelGateway } from '@core/interfaces';
import { AppLogger } from '@core/logger';
import { SummaryController } from './../controllers/summary-controller';
import { IWeatherGateway } from './../gateways/weather-gateway';

export function createSummaryRouter(
    llmGateway: LanguageModelGateway,
    weatherGateway: IWeatherGateway,
    logger: AppLogger
) {
    const router = Router();
    const controller = new SummaryController(logger, llmGateway, weatherGateway);
    const handler = new ApiHandler(logger);

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getGroundsSummary', (context) => {
            return controller.getGroundsSummary(context.userId!);
        });
    });

    return router;
}
