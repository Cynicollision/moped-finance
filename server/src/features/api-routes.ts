import { Router } from 'express';
import { GeminiGateway } from '@core/gateways/gemini-gateway';
import { DatabaseClient } from '@core/db';
import { AppLogger } from '@core/logger';
import { createFinanceModule } from '@features/finance/routes';
import { WeatherGateway } from '@features/grounds/gateways/weather-gateway';
import { createGroundsModule } from '@features/grounds/routes';

export function createApiRouter(
    dbClient: DatabaseClient,
    logger: AppLogger,
    llmGateway: GeminiGateway,
    resolveUser: any,
    requireAuth: any
): Router {
    const router = Router();

    // Finance routes
    const financeRoutes = createFinanceModule(dbClient, logger);
    router.use('/finance', resolveUser, requireAuth, financeRoutes);

    // Grounds routes
    const weatherGateway = WeatherGateway.fromEnvironment();
    const groundsRoutes = createGroundsModule(dbClient, logger, llmGateway, weatherGateway);
    router.use('/grounds', resolveUser, requireAuth, groundsRoutes);

    return router;
}
