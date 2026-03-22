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
        const result = await groundsLogic.getCareTasks(user!.id);

        return ApiHandler.succeed(res, result);
    }
    catch (error) {
        return ApiHandler.failInternalError(res, error);
    }
});

export default router;