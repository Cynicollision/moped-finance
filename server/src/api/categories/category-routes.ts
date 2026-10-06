import { Router } from 'express';
import { z } from 'zod';
import { IAppLogger } from '@server/logging';
import { idParamsSchema, OperationDefinition, OperationHandler, QueryField } from '@server/routing';
import { CategoryController } from './category-controller';
import { IFinanceCategoryData } from './category-data';
import { createCategorySchema, updateCategorySchema } from './category-schema';
import { IFinanceCategoryGroupData, createCategoryGroupSchema, updateCategoryGroupSchema } from './category-groups';

const domain = 'Category';

export function createCategoryRouter(
    logger: IAppLogger,
    categoriesData: IFinanceCategoryData,
    groupsData: IFinanceCategoryGroupData
) {
    const router = Router();
    const controller = new CategoryController(logger, categoriesData, groupsData);
    const handler = new OperationHandler(logger);

    // --- Category Groups ---

    // GET /groups - Get Category Groups
    router.get('/groups', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getGroups' };
        handler.execute(req, res, op, context => {
            return controller.getGroups(context);
        });
    });

    // GET /groups/:id - Get Category Group
    router.get('/groups/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getGroup' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.getGroup(context, params.id);
        });
    });

    // POST /groups - Create Category Group
    router.post('/groups', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createGroup' };
        handler.execute(req, res, op, { body: createCategoryGroupSchema }, (context, { body }) => {
            return controller.createGroup(context, body);
        });
    });

    // PUT /groups/:id - Update Category Group
    router.put('/groups/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'updateGroup' };
        handler.execute(
            req,
            res,
            op,
            { params: idParamsSchema, body: updateCategoryGroupSchema },
            (context, { params, body }) => {
                return controller.updateGroup(context, params.id, body);
            }
        );
    });

    // DELETE /groups/:id - Delete Category Group
    router.delete('/groups/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteGroup' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.deleteGroup(context, params.id);
        });
    });

    // --- Categories ---

    // GET / - Get Categories
    const categoriesQuerySchema = z.object({
        activeOnly: QueryField.boolean().optional()
    });

    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getCategories' };
        handler.execute(req, res, op, { query: categoriesQuerySchema }, (context, { query }) => {
            return controller.getCategories(context, query.activeOnly);
        });
    });

    // GET /:id - Get Category
    router.get('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getCategory' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.getCategory(context, params.id);
        });
    });

    // GET /:id/usage - Get what uses a Category
    router.get('/:id/usage', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getCategoryUsage' };
        handler.execute(req, res, op, { params: idParamsSchema }, (context, { params }) => {
            return controller.getCategoryUsage(context, params.id);
        });
    });

    // POST / - Create Category
    router.post('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createCategory' };
        handler.execute(req, res, op, { body: createCategorySchema }, (context, { body }) => {
            return controller.createCategory(context, body);
        });
    });

    // PUT /:id - Update Category
    router.put('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'updateCategory' };
        handler.execute(
            req,
            res,
            op,
            { params: idParamsSchema, body: updateCategorySchema },
            (context, { params, body }) => {
                return controller.updateCategory(context, params.id, body);
            }
        );
    });

    // DELETE /:id - Delete Category, moving its transactions to moveTo (Uncategorized without it)
    const deleteCategoryQuerySchema = z.object({
        moveTo: z.string().min(1).max(50).optional()
    });

    router.delete('/:id', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteCategory' };
        handler.execute(
            req,
            res,
            op,
            { params: idParamsSchema, query: deleteCategoryQuerySchema },
            (context, { params, query }) => {
                return controller.deleteCategory(context, params.id, query.moveTo);
            }
        );
    });

    return router;
}
