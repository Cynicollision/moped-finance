import { Router } from 'express';
import { ApiHandler } from '@core/api-handler';
import { AppLogger } from '@core/logger';
import { RequestSchemaValidator } from '@core/validation';
import { CategoryController } from './category-controller';
import { IFinanceCategoriesData } from './category-data';
import { createCategorySchema, updateCategorySchema } from './category-schema';

export function createCategoryRouter(logger: AppLogger, categoriesData: IFinanceCategoriesData) {
    const router = Router();
    const controller = new CategoryController(logger, categoriesData);
    const handler = new ApiHandler(logger);
    const validator = new RequestSchemaValidator(logger, 'Category');

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getCategories', (context) => {
            const activeOnly = req.query.activeOnly === 'true';
            return controller.getCategories(context.userId!, activeOnly);
        });
    });

    router.get('/:id', validator.id(), (req, res) => {
        handler.execute(req, res, 'getCategory', (context) => {
            return controller.getCategory(context.userId!, req.params.id);
        });
    });

    router.post('/', validator.body(createCategorySchema), (req, res) => {
        handler.execute(req, res, 'createCategory', (context) => {
            return controller.createCategory(context.userId!, req.body);
        });
    });

    router.put('/:id', validator.id(), validator.body(updateCategorySchema), (req, res) => {
        handler.execute(req, res, 'updateCategory', (context) => {
            const category = { ...req.body, id: req.params.id };
            return controller.updateCategory(context.userId!, category);
        });
    });

    router.delete('/:id', validator.id(), (req, res) => {
        handler.execute(req, res, 'deleteCategory', (context) => {
            return controller.deleteCategory(context.userId!, req.params.id);
        });
    });

    return router;
}
