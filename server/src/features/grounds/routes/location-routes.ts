import { Router } from 'express';
import { ApiHandler } from '@core/api-handler';
import { AppLogger } from '@core/logger';
import { IGroundsLocationData } from './../data/location-data';
import { LocationController } from './../controllers/location-controller';

export function createLocationRouter(
    locationData: IGroundsLocationData,
    logger: AppLogger
) {
    const router = Router();
    const controller = new LocationController(logger, locationData);
    const handler = new ApiHandler(logger);

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getLocations', (context) => {
            return controller.getLocations(context.userId!);
        });
    });

    return router;
}
