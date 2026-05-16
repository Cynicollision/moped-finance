import { Router } from 'express';
import { CareTask } from '@shared/grounds/types';
import { ApiHandler } from '@core/api-handler';
import { AppLogger } from '@core/logger';
import { CareTaskController } from './../controllers/care-task-controller';
import { IGroundsCareTaskData } from './../data/care-task-data';

export function createCareTaskRouter(
    careTaskData: IGroundsCareTaskData,
    logger: AppLogger
) {
    const router = Router();
    const controller = new CareTaskController(logger, careTaskData);
    const handler = new ApiHandler(logger);

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getCareTasks', (context) => {
            const year = (req.query.year as string) || new Date().getFullYear().toString();
            return controller.getCareTasks(context.userId!, year);
        });
    });

    router.post('/', (req, res) => {
        handler.execute(req, res, 'createCareTask', (context) => {
            return controller.createCareTask(context.userId!, req.body);
        });
    });

    router.put('/:id', (req, res) => {
        handler.execute(req, res, 'saveCareTask', (context) => {
            const task: CareTask = req.body;
            task.id = req.params.id; // ensure ID from URL param overrides body
            return controller.saveCareTask(context.userId!, task);
        });
    });

    return router;
}
