import { Router } from 'express';
import { ApiHandler } from '@server-core/api-handler';
import { AppLogger } from '@server-core/logger';
import { RequestSchemaValidator } from '@server-core/validation';
import { CategoryController } from './category-controller';
import { IFinanceCategoryData } from './category-data';
import { createCategorySchema, updateCategorySchema } from './category-schema';
import { IFinanceCategoryGroupData } from './category-groups/category-group-data';
import { createCategoryGroupSchema, updateCategoryGroupSchema } from './category-groups/category-group-schema';

export function createCategoryRouter(logger: AppLogger, categoriesData: IFinanceCategoryData, groupsData: IFinanceCategoryGroupData) {
    const router = Router();
    const controller = new CategoryController(logger, categoriesData, groupsData);
    const handler = new ApiHandler(logger);
    const categoryValidator = new RequestSchemaValidator(logger, 'Category');
    const groupValidator = new RequestSchemaValidator(logger, 'CategoryGroup');

    // --- Category Groups ---
    router.get('/groups', (req, res) => {
        handler.execute(req, res, 'getGroups', (context) => {
            return controller.getGroups(context.userId!);
        });
    });

    router.get('/groups/:id', groupValidator.id(), (req, res) => {
        handler.execute(req, res, 'getGroup', (context) => {
            return controller.getGroup(context.userId!, req.params.id);
        });
    });

    router.post('/groups', groupValidator.body(createCategoryGroupSchema), (req, res) => {
        handler.execute(req, res, 'createGroup', (context) => {
            return controller.createGroup(context.userId!, req.body);
        });
    });

    router.put('/groups/:id', groupValidator.id(), groupValidator.body(updateCategoryGroupSchema), (req, res) => {
        handler.execute(req, res, 'updateGroup', (context) => {
            const group = { ...req.body, id: req.params.id };
            return controller.updateGroup(context.userId!, group);
        });
    });

    router.delete('/groups/:id', groupValidator.id(), (req, res) => {
        handler.execute(req, res, 'deleteGroup', (context) => {
            return controller.deleteGroup(context.userId!, req.params.id);
        });
    });

    // --- Categories ---
    router.get('/', (req, res) => {
        handler.execute(req, res, 'getCategories', (context) => {
            const activeOnly = req.query.activeOnly === 'true';
            return controller.getCategories(context.userId!, activeOnly);
        });
    });

    router.get('/:id', categoryValidator.id(), (req, res) => {
        handler.execute(req, res, 'getCategory', (context) => {
            return controller.getCategory(context.userId!, req.params.id);
        });
    });

    router.post('/', categoryValidator.body(createCategorySchema), (req, res) => {
        handler.execute(req, res, 'createCategory', (context) => {
            return controller.createCategory(context.userId!, req.body);
        });
    });

    router.put('/:id', categoryValidator.id(), categoryValidator.body(updateCategorySchema), (req, res) => {
        handler.execute(req, res, 'updateCategory', (context) => {
            const category = { ...req.body, id: req.params.id };
            return controller.updateCategory(context.userId!, category);
        });
    });

    router.delete('/:id', categoryValidator.id(), (req, res) => {
        handler.execute(req, res, 'deleteCategory', (context) => {
            return controller.deleteCategory(context.userId!, req.params.id);
        });
    });

    return router;
}
