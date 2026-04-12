import { Router, Request, Response } from 'express';
import { ApiHandler } from './api-handler';
import { AppLogger } from './../core/logger';
import { GroundsData } from './../features/grounds-data';
import { GroundsLogic } from './../features/grounds-logic';

const router = Router();
const logger = AppLogger.forPgDatabase();
const groundsData = GroundsData.forPgDatabase();
const groundsLogic = new GroundsLogic(groundsData);
const handler = new ApiHandler(logger);

router.get('/data/locations', (req, res) => {
    handler.execute(req, res, 'getLocations', (context) => {
        return groundsLogic.getLocations(context.userId!);
    });
});

router.get('/data/plants', (req, res) => {
    handler.execute(req, res, 'getPlants', (context) => {
        const varietyId = req.query.varietyId as string;
        return groundsLogic.getPlants(context.userId!, varietyId);
    });
});

router.get('/data/plant-varieties', (req, res) => {
    handler.execute(req, res, 'getPlantVarieties', (context) => {
        return groundsLogic.getPlantVarieties(context.userId!);
    });
});

router.get('/data/plant-varieties/:id', (req, res) => {
    handler.execute(req, res, 'getPlantVariety', (context) => {
        return groundsLogic.getPlantVariety(context.userId!, req.params.id);
    });
});

router.put('/data/plant-varieties/:id', (req, res) => {
    handler.execute(req, res, 'savePlantData', (context) => {
        const requestBody = req.body;
        const variety = requestBody.variety;
        const plants = requestBody.plants || [];

        variety.id = req.params.id; // ensure ID from URL param overrides body
        return groundsLogic.savePlantData(context.userId!, variety, plants);
    });
});

router.get('/data/products', (req, res) => {
    handler.execute(req, res, 'getProducts', (context) => {
        return groundsLogic.getProducts(context.userId!);
    });
});

router.get('/data/tasks', (req, res) => {
    handler.execute(req, res, 'getCareTasks', (context) => {
        const year = (req.query.year as string) || new Date().getFullYear().toString();
        return groundsLogic.getCareTasks(context.userId!, year);
    });
});

router.post('/data/tasks', (req, res) => {
    handler.execute(req, res, 'createCareTask', (context) => {
        return groundsLogic.createCareTask(context.userId!, req.body);
    });
});

router.put('/data/tasks/:id', (req, res) => {
    handler.execute(req, res, 'saveCareTask', (context) => {
        const task = req.body;
        task.id = req.params.id; // ensure ID from URL param overrides body
        return groundsLogic.saveCareTask(context.userId!, task);
    });
});

export default router;