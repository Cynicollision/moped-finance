import { Router } from 'express';
import { Category } from '@shared/finance/types';
import { IAppLogger } from '@server-core/logging';
import { OperationDefinition, OperationHandler, RequestSchemaValidator } from '@server-core/routing';
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
    router.get('/groups', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getGroups' };
        handler.execute(req, res, op, (context) => {
            return controller.getGroups(context);
        });
    });

    router.get('/groups/:id', groupValidator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getGroup' };
        handler.execute(req, res, op, (context) => {
            return controller.getGroup(context, req.params.id);
        });
    });

    router.post('/groups', groupValidator.body(createCategoryGroupSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createGroup' };
        handler.execute(req, res, op, (context) => {
            return controller.createGroup(context, req.body);
        });
    });

    router.put('/groups/:id', groupValidator.id(), groupValidator.body(updateCategoryGroupSchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'updateGroup' };
        handler.execute(req, res, op, (context) => {
            const group = { ...req.body, id: req.params.id };
            return controller.updateGroup(context, group);
        });
    });

    router.delete('/groups/:id', groupValidator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteGroup' };
        handler.execute(req, res, op, (context) => {
            return controller.deleteGroup(context, req.params.id);
        });
    });

    // --- Categories ---
    router.get('/', (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getCategories' };
        handler.execute(req, res, op, (context) => {
            const activeOnly = req.query.activeOnly === 'true';
            return controller.getCategories(context, activeOnly);
        });
    });

    router.get('/:id', categoryValidator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'getCategory' };
        handler.execute(req, res, op, (context) => {
            return controller.getCategory(context, req.params.id);
        });
    });

    router.post('/', categoryValidator.body(createCategorySchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'createCategory' };
        handler.execute(req, res, op, (context) => {
            return controller.createCategory(context, req.body);
        });
    });

    router.put('/:id', categoryValidator.id(), categoryValidator.body(updateCategorySchema), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'updateCategory' };
        handler.execute(req, res, op, (context) => {
            const category: Category = req.body;
            category.id = req.params.id;
            return controller.updateCategory(context, category);
        });
    });

    router.delete('/:id', categoryValidator.id(), (req, res) => {
        const op: OperationDefinition = { domain, operation: 'deleteCategory' };
        handler.execute(req, res, op, (context) => {
            return controller.deleteCategory(context, req.params.id);
        });
    });

    return router;
}
