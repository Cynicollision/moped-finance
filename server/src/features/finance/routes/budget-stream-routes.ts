import { Router } from 'express';
import { BudgetStream } from '@shared/finance/types';
import { ApiHandler } from '@core/api-handler';
import { AppLogger } from '@core/logger';
import { BudgetStreamController } from './../controllers/budget-stream-controller';
import { IFinanceBudgetStreamData } from './../data/budget-stream-data';

export function createBudgetStreamRouter(
    budgetStreamData: IFinanceBudgetStreamData,
    logger: AppLogger
) {
    const router = Router();
    const controller = new BudgetStreamController(logger, budgetStreamData);
    const handler = new ApiHandler(logger);

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getBudgetStreams', (context) => {
            return controller.getBudgetStreams(context.userId!);
        });
    });

    router.post('/', (req, res) => {
        handler.execute(req, res, 'createBudgetStream', (context) => {
            const stream: BudgetStream = req.body;
            return controller.createBudgetStream(context.userId!, stream);
        });
    });

    router.put('/:id', (req, res) => {
        handler.execute(req, res, 'saveBudgetStream', (context) => {
            const stream: BudgetStream = req.body;
            stream.id = req.params.id; // ensure ID from URL param overrides body
            return controller.saveBudgetStream(context.userId!, stream);
        });
    });

    router.delete('/:id', (req, res) => {
        handler.execute(req, res, 'deleteBudgetStream', (context) => {
            return controller.deleteBudgetStream(context.userId!, req.params.id);
        });
    });

    return router;
}
