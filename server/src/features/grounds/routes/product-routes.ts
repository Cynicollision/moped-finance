import { Router } from 'express';
import { Product } from '@shared/grounds/types';
import { ApiHandler } from '@core/api-handler';
import { AppLogger } from '@core/logger';
import { ProductController } from './../controllers/product-controller';
import { IGroundsProductData } from './../data/product-data';

export function createProductRouter(
    productData: IGroundsProductData,
    logger: AppLogger
) {
    const router = Router();
    const controller = new ProductController(logger, productData);
    const handler = new ApiHandler(logger);

    router.get('/', (req, res) => {
        handler.execute(req, res, 'getProducts', (context) => {
            return controller.getProducts(context.userId!);
        });
    });

    router.get('/:id', (req, res) => {
        handler.execute(req, res, 'getProduct', (context) => {
            return controller.getProduct(context.userId!, req.params.id);
        });
    });

    router.post('/', (req, res) => {
        handler.execute(req, res, 'createProduct', (context) => {
            return controller.createProduct(context.userId!, req.body);
        });
    });

    router.put('/:id', (req, res) => {
        handler.execute(req, res, 'saveProduct', (context) => {
            const product: Product = req.body;
            product.id = req.params.id; // ensure ID from URL param overrides body
            return controller.saveProduct(context.userId!, product);
        });
    });

    router.delete('/:id', (req, res) => {
        handler.execute(req, res, 'deleteProduct', (context) => {
            return controller.deleteProduct(context.userId!, req.params.id);
        });
    });

    return router;
}
