import { Router } from 'express';
import { z } from 'zod';
import { Category } from '@shared/finance/types';
import { IAppLogger } from '@server/logging';
import { OperationDefinition, OperationHandler, RequestSchemaValidator } from '@server/routing';
import { CategoryController } from './category-controller';
import { IFinanceCategoryData } from './category-data';
import { createCategorySchema, updateCategorySchema } from './category-schema';
import { IFinanceCategoryGroupData, createCategoryGroupSchema, updateCategoryGroupSchema } from './category-groups';

const domain = 'Category';

export function createCategoryRouter(logger: IAppLogger, categoriesData: IFinanceCategoryData, groupsData: IFinanceCategoryGroupData) {
    const router = Router();
    const controller = new CategoryController(logger, categoriesData, groupsData);
    const handler = new OperationHandler(logger);
    const categoryValidator = new RequestSchemaValidator(logger, 'Category');
    const groupValidator = new RequestSchemaValidator(logger, 'CategoryGroup');

    // --- Category Groups ---
    
    // GET /groups - Get Category Groups
    router.get('/groups', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getGroups' };
        handler.execute(req, res, op, (context) => {
            return controller.getGroups(context);
        });
    });

    // GET /groups/:id - Get Category Group
    router.get('/groups/:id', groupValidator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getGroup' };
        handler.execute(req, res, op, (context) => {
            return controller.getGroup(context, req.params.id);
        });
    });

    // POST /groups - Create Category Group
    router.post('/groups', groupValidator.body(createCategoryGroupSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createGroup' };
        handler.execute(req, res, op, (context) => {
            return controller.createGroup(context, req.body);
        });
    });

    // PUT /groups/:id - Update Category Group
    router.put('/groups/:id', groupValidator.id(), groupValidator.body(updateCategoryGroupSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'updateGroup' };
        handler.execute(req, res, op, (context) => {
            const group = { ...req.body, id: req.params.id };
            return controller.updateGroup(context, group);
        });
    });

    // DELETE /groups/:id - Delete Category Group
    router.delete('/groups/:id', groupValidator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteGroup' };
        handler.execute(req, res, op, (context) => {
            return controller.deleteGroup(context, req.params.id);
        });
    });

    // --- Categories ---
    
    // GET / - Get Categories
    const activeOnlyQuerySchema = z.object({
        activeOnly: z.enum(['true', 'false']).transform(v => v === 'true').optional()
    });

    router.get('/', categoryValidator.query(activeOnlyQuerySchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getCategories' };
        handler.execute(req, res, op, (context) => {
            const { activeOnly } = req.query as any;
            return controller.getCategories(context, activeOnly);
        });
    });

    // GET /:id - Get Category
    router.get('/:id', categoryValidator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getCategory' };
        handler.execute(req, res, op, (context) => {
            return controller.getCategory(context, req.params.id);
        });
    });

    // POST / - Create Category
    router.post('/', categoryValidator.body(createCategorySchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createCategory' };
        handler.execute(req, res, op, (context) => {
            return controller.createCategory(context, req.body);
        });
    });

    // PUT /:id - Update Category
    router.put('/:id', categoryValidator.id(), categoryValidator.body(updateCategorySchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'updateCategory' };
        handler.execute(req, res, op, (context) => {
            const category: Category = req.body;
            category.id = req.params.id;
            return controller.updateCategory(context, category);
        });
    });

    // DELETE /:id - Delete Category
    router.delete('/:id', categoryValidator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteCategory' };
        handler.execute(req, res, op, (context) => {
            return controller.deleteCategory(context, req.params.id);
        });
    });

    return router;
}
