import { Router } from 'express';
import { ApiHandler } from '@core/api-handler';
import { AppLogger } from '@core/logger';
import { PlantController } from './../controllers/plant-controller';

export function createPlantRouter(
    controller: PlantController,
    logger: AppLogger
) {
    const router = Router();
    const handler = new ApiHandler(logger);

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getPlants', (context) => {
            const varietyId = req.query.varietyId as string;
            return controller.getPlants(context.userId!, varietyId);
        });
    });

    return router;
}
