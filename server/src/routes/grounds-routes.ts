import { Router, Request, Response } from 'express';
import { ApiHandler } from './api-handler';
import { GroundsData } from './../data-access/grounds-data';
import { GroundsLogic } from './../feature-logic/grounds-logic';

const router = Router();
const groundsData = GroundsData.forPgDatabase();
const groundsLogic = new GroundsLogic(groundsData);

router.get('/data/care-tasks', async (_req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(_req);
        const year = (_req.query.year as string) || new Date().getFullYear().toString();
        const result = await groundsLogic.getCareTasks(user!.id, year);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/locations', async (_req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(_req);
        const result = await groundsLogic.getLocations(user!.id);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/plants', async (_req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(_req);
        const result = await groundsLogic.getPlants(user!.id);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/plant-varieties', async (_req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(_req);
        const result = await groundsLogic.getPlantVarieties(user!.id);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

router.get('/data/products', async (_req: Request, res: Response) => {
    try {
        const user = ApiHandler.getUser(_req);
        const result = await groundsLogic.getProducts(user!.id);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

export default router;