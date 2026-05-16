import { Router } from 'express';
import { Plant, PlantVariety } from '@shared/grounds/types';
import { ApiHandler } from '@core/api-handler';
import { AppLogger } from '@core/logger';
import { PlantController } from './../controllers/plant-controller';

export function createPlantVarietyRouter(
    controller: PlantController,
    logger: AppLogger
) {
    const router = Router();
    const handler = new ApiHandler(logger);

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getPlantVarieties', (context) => {
            return controller.getPlantVarieties(context.userId!);
        });
    });

    router.get('/:id', (req, res) => {
        handler.execute(req, res, 'getPlantVariety', (context) => {
            return controller.getPlantVariety(context.userId!, req.params.id);
        });
    });

    router.put('/:id', (req, res) => {
        handler.execute(req, res, 'savePlantData', (context) => {
            const requestBody = req.body;
            const variety: PlantVariety = requestBody.variety;
            const plants: Plant[] = requestBody.plants || [];

            variety.id = req.params.id; // ensure ID from URL param overrides body
            return controller.savePlantData(context.userId!, variety, plants);
        });
    });

    return router;
}
