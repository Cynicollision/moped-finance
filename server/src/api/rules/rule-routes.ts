import { Router } from 'express';
import { IAppLogger } from '@server/logging';
import { idParamsSchema, OperationDefinition, OperationHandler } from '@server/routing';
import { ICategoryData } from './../categories/category-data';
import { RuleController } from './rule-controller';
import { IRuleData } from './rule-data';
import { createRuleSchema, ruleOrderSchema, updateRuleSchema } from './rule-schema';

const domain = 'Rule';

export function createRuleRouter(logger: IAppLogger, ruleData: IRuleData, categoryData: ICategoryData) {
    const router = Router();
    const handler = new OperationHandler(logger);
    const controller = new RuleController(logger, ruleData, categoryData);

    // GET / - Get Rules, in order
    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getRules' };
        handler.execute(req, res, op, context => {
            return controller.getRules(context);
        });
    });

    // POST / - Create Rule, at the end of the list
    router.post('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createRule' };
        handler.execute(req, res, op, { body: createRuleSchema }, (context, { body }) => {
            return controller.createRule(context, body);
        });
    });

    // PUT /order - Reorder Rules, given every rule's ID
    router.put('/order', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'reorderRules' };
        handler.execute(req, res, op, { body: ruleOrderSchema }, (context, { body }) => {
            return controller.reorderRules(context, body);
        });
    });

    // GET /:id - Get Rule
    router.get('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getRule' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.getRule(context, params.id);
        });
    });

    // PUT /:id - Update Rule
    router.put('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'saveRule' };
        handler.execute(
            req,
            res,
            op,
            { params: idParamsSchema, body: updateRuleSchema },
            (context, { params, body }) => {
                return controller.saveRule(context, params.id, body);
            }
        );
    });

    // DELETE /:id - Delete Rule
    router.delete('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteRule' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.deleteRule(context, params.id);
        });
    });

    // GET /:id/matches - What applying the rule to existing transactions would change
    router.get('/:id/matches', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getRuleMatches' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.getRuleMatches(context, params.id);
        });
    });

    // POST /:id/apply - Apply the rule to existing transactions
    router.post('/:id/apply', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'applyRule' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.applyRule(context, params.id);
        });
    });

    return router;
}
