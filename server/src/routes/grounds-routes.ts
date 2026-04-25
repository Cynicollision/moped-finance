import { Router, Request, Response } from 'express';
import { ApiHandler } from './api-handler';
import { AppLogger } from './../core/logger';
import { GroundsController } from './../features/grounds-controller';
import { GroundsData } from './../features/grounds-data';

const router = Router();

const logger = AppLogger.fromEnvironment();
const groundsData = GroundsData.forPgDatabase();
const controller = new GroundsController(groundsData);
const handler = new ApiHandler(logger);

router.get('/data/locations', (req, res) => {
    handler.execute(req, res, 'getLocations', (context) => {
        return controller.getLocations(context.userId!);
    });
});

router.get('/data/plants', (req, res) => {
    handler.execute(req, res, 'getPlants', (context) => {
        const varietyId = req.query.varietyId as string;
        return controller.getPlants(context.userId!, varietyId);
    });
});

router.get('/data/plant-varieties', (req, res) => {
    handler.execute(req, res, 'getPlantVarieties', (context) => {
        return controller.getPlantVarieties(context.userId!);
    });
});

router.get('/data/plant-varieties/:id', (req, res) => {
    handler.execute(req, res, 'getPlantVariety', (context) => {
        return controller.getPlantVariety(context.userId!, req.params.id);
    });
});

router.put('/data/plant-varieties/:id', (req, res) => {
    handler.execute(req, res, 'savePlantData', (context) => {
        const requestBody = req.body;
        const variety = requestBody.variety;
        const plants = requestBody.plants || [];

        variety.id = req.params.id; // ensure ID from URL param overrides body
        return controller.savePlantData(context.userId!, variety, plants);
    });
});

router.get('/data/products', (req, res) => {
    handler.execute(req, res, 'getProducts', (context) => {
        return controller.getProducts(context.userId!);
    });
});

router.get('/data/tasks', (req, res) => {
    handler.execute(req, res, 'getCareTasks', (context) => {
        const year = (req.query.year as string) || new Date().getFullYear().toString();
        return controller.getCareTasks(context.userId!, year);
    });
});

router.post('/data/tasks', (req, res) => {
    handler.execute(req, res, 'createCareTask', (context) => {
        return controller.createCareTask(context.userId!, req.body);
    });
});

router.put('/data/tasks/:id', (req, res) => {
    handler.execute(req, res, 'saveCareTask', (context) => {
        const task = req.body;
        task.id = req.params.id; // ensure ID from URL param overrides body
        return controller.saveCareTask(context.userId!, task);
    });
});

export default router;