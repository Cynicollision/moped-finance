import { Router } from 'express';
import { BudgetStream } from '@shared/finance/types';
import { ApiHandler } from '@server-core/api-handler';
import { AppLogger } from '@server-core/logger';
import { RequestSchemaValidator } from '@server-core/validation';
import { BudgetStreamController } from './budget-stream-controller';
import { IFinanceBudgetStreamData } from './budget-stream-data';
import { createBudgetStreamSchema, updateBudgetStreamSchema } from './budget-stream-schema';

export function createBudgetStreamRouter(logger: AppLogger, budgetStreamData: IFinanceBudgetStreamData) {
    const router = Router();
    const handler = new ApiHandler(logger);
    const validator = new RequestSchemaValidator(logger, 'BudgetStream');
    const controller = new BudgetStreamController(logger, budgetStreamData);

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getBudgetStreams', (context) => {
            return controller.getBudgetStreams(context.userId!);
        });
    });

    router.post('/', validator.body(createBudgetStreamSchema), (req, res) => {
        handler.execute(req, res, 'createBudgetStream', (context) => {
            const stream: BudgetStream = req.body;
            return controller.createBudgetStream(context.userId!, stream);
        });
    });

    router.put('/:id', validator.id(), validator.body(updateBudgetStreamSchema), (req, res) => {
        handler.execute(req, res, 'saveBudgetStream', (context) => {
            const stream: BudgetStream = req.body;
            stream.id = req.params.id; // ensure ID from URL param overrides body
            return controller.saveBudgetStream(context.userId!, stream);
        });
    });

    router.delete('/:id', validator.id(), (req, res) => {
        handler.execute(req, res, 'deleteBudgetStream', (context) => {
            return controller.deleteBudgetStream(context.userId!, req.params.id);
        });
    });

    return router;
}
