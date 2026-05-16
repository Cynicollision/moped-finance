import { Router } from 'express';
import { ApiHandler } from '@core/api-handler';
import { AppLogger } from '@core/logger';
import { CategoryController } from './../controllers/category-controller';
import { IFinanceCategoriesData } from './../data/categories-data';

export function createCategoryRouter(
    categoriesData: IFinanceCategoriesData,
    logger: AppLogger
) {
    const router = Router();
    const controller = new CategoryController(logger, categoriesData);
    const handler = new ApiHandler(logger);

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getCategories', (context) => {
            const activeOnly = req.query.activeOnly === 'true';
            return controller.getCategories(context.userId!, activeOnly);
        });
    });

    return router;
}
