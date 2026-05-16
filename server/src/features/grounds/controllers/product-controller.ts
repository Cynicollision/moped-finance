import { OperationResult } from '@shared/common/contracts';
import { EntityIdPrefix } from '@shared/common/enum';
import { Product } from '@shared/grounds/types';
import { AppLogger } from '@core/logger';
import { EntityIdUtil, ResultUtil } from '@core/utility';
import { IGroundsProductData } from './../data/product-data';

export class ProductController {
    constructor(
        private logger: AppLogger,
        private products: IGroundsProductData
    ) {
    }

    public async getProducts(userId: string): Promise<OperationResult<Product[]>> {
        return ResultUtil.success(await this.products.retrieveAll(userId));
    }

    public async getProduct(userId: string, productId: string): Promise<OperationResult<Product>> {
        const product = await this.products.retrieveSingle(userId, productId);
        if (!product) {
            return ResultUtil.userError('Product not found or access denied');
        }
        return ResultUtil.success(product);
    }

    public async createProduct(userId: string, product: Product): Promise<OperationResult<Product>> {
        product.userId = userId;
        product.id = EntityIdUtil.generate(EntityIdPrefix.GroundsProduct);
        return ResultUtil.success(await this.products.insert(product));
    }

    public async saveProduct(userId: string, product: Product): Promise<OperationResult<Product>> {
        const updated = await this.products.update(userId, product);
        if (!updated) {
            return ResultUtil.userError('Product not found or access denied');
        }
        return ResultUtil.success(updated);
    }

    public async deleteProduct(userId: string, productId: string): Promise<OperationResult<void>> {
        const deleted = await this.products.delete(userId, productId);
        if (!deleted) {
            return ResultUtil.userError('Product not found or access denied');
        }
        return ResultUtil.success();
    }
}
