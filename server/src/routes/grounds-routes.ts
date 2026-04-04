import { Router, Request, Response } from 'express';
import { ApiHandler } from './api-handler';
import { GroundsData } from './../data-access/grounds-data';
import { GroundsLogic } from './../logic/grounds-logic';
import { AppLogger } from './../utility/logger';

const router = Router();
const logger = AppLogger.forPgDatabase();
const groundsData = GroundsData.forPgDatabase();
const groundsLogic = new GroundsLogic(logger, groundsData);

router.get('/data/locations', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const result = await groundsLogic.getLocations(user!.id);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/plants', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const varietyId = req.query.varietyId as string;
        const result = await groundsLogic.getPlants(user!.id, varietyId);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/plant-varieties', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const result = await groundsLogic.getPlantVarieties(user!.id);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/plant-varieties/:id', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const result = await groundsLogic.getPlantVariety(user!.id, req.params.id);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.put('/data/plant-varieties/:id', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const requestBody = req.body;
        const variety = requestBody.variety;
        const plants = requestBody.plants || [];

        variety.id = req.params.id; // ensure ID from URL param overrides body
        const result = await groundsLogic.savePlantData(user!.id, variety, plants);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/products', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const result = await groundsLogic.getProducts(user!.id);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/tasks', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const year = (req.query.year as string) || new Date().getFullYear().toString();
        const result = await groundsLogic.getCareTasks(user!.id, year);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.post('/data/tasks', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const task = req.body;
        const result = await groundsLogic.createCareTask(user!.id, task);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.put('/data/tasks/:id', async (req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(req);
        const task = req.body;
        task.id = req.params.id; // ensure ID from URL param overrides body
        const result = await groundsLogic.saveCareTask(user!.id, task);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

export default router;