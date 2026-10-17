import { Router } from 'express';
import { IAppLogger } from '@server/logging';
import { idParamsSchema, OperationDefinition, OperationHandler } from '@server/routing';
import { BudgetStreamController } from './budget-stream-controller';
import { IBudgetStreamData } from './budget-stream-data';
import { createBudgetStreamSchema, updateBudgetStreamSchema } from './budget-stream-schema';

const domain = 'BudgetStream';

export function createBudgetStreamRouter(logger: IAppLogger, budgetStreamData: IBudgetStreamData) {
    const router = Router();
    const handler = new OperationHandler(logger);
    const controller = new BudgetStreamController(logger, budgetStreamData);

    // GET / - Get Budget Streams
    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getBudgetStreams' };
        handler.execute(req, res, op, context => {
            return controller.getBudgetStreams(context);
        });
    });

    // POST / - Create Budget Stream
    router.post('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createBudgetStream' };
        handler.execute(req, res, op, { body: createBudgetStreamSchema }, (context, { body }) => {
            return controller.createBudgetStream(context, body);
        });
    });

    // PUT /:id - Update Budget Stream
    router.put('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'saveBudgetStream' };
        handler.execute(
            req,
            res,
            op,
            { params: idParamsSchema, body: updateBudgetStreamSchema },
            (context, { params, body }) => {
                return controller.saveBudgetStream(context, params.id, body);
            }
        );
    });

    // DELETE /:id - Delete Budget Stream
    router.delete('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteBudgetStream' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.deleteBudgetStream(context, params.id);
        });
    });

    return router;
}
