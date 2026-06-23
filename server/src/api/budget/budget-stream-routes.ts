import { Router } from 'express';
import { BudgetStream } from '@shared/finance/types';
import { IAppLogger } from '@server/logging';
import { OperationDefinition, OperationHandler, RequestSchemaValidator } from '@server/routing';
import { BudgetStreamController } from './budget-stream-controller';
import { IFinanceBudgetStreamData } from './budget-stream-data';
import { createBudgetStreamSchema, updateBudgetStreamSchema } from './budget-stream-schema';

const domain = 'BudgetStream';

export function createBudgetStreamRouter(logger: IAppLogger, budgetStreamData: IFinanceBudgetStreamData) {
    const router = Router();
    const handler = new OperationHandler(logger);
    const validator = new RequestSchemaValidator(logger, 'BudgetStream');
    const controller = new BudgetStreamController(logger, budgetStreamData);

    // GET / - Get Budget Streams
    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getBudgetStreams' };
        handler.execute(req, res, op, (context) => {
            return controller.getBudgetStreams(context);
        });
    });

    // POST / - Create Budget Stream
    router.post('/', validator.body(createBudgetStreamSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createBudgetStream' };
        handler.execute(req, res, op, (context) => {
            const stream: BudgetStream = req.body;
            return controller.createBudgetStream(context, stream);
        });
    });

    // PUT /:id - Update Budget Stream
    router.put('/:id', validator.id(), validator.body(updateBudgetStreamSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'saveBudgetStream' };
        handler.execute(req, res, op, (context) => {
            const stream: BudgetStream = req.body;
            stream.id = req.params.id;
            return controller.saveBudgetStream(context, stream);
        });
    });

    // DELETE /:id - Delete Budget Stream
    router.delete('/:id', validator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteBudgetStream' };
        handler.execute(req, res, op, (context) => {
            return controller.deleteBudgetStream(context, req.params.id);
        });
    });

    return router;
}
