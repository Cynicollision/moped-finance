import { CareTask, Location, Plant, PlantVariety, Product } from '@shared/grounds/types';
import { EntityIdPrefix } from '@shared/core/enum/entity-id-prefix';
import { EntityIdUtil } from './../utility/entity-id';
import { BadRequestError } from './../utility/errors';
import { IGroundsData } from './grounds-data';

export class GroundsController {
    constructor(private groundsData: IGroundsData) {
    }

    public async getCareTasks(userId: string, year: string): Promise<CareTask[]> {
        return this.groundsData.careTasks.retrieveAll(userId);
    }

    public async createCareTask(userId: string, task: CareTask): Promise<CareTask> {
        task.userId = userId;
        task.id = EntityIdUtil.generate(EntityIdPrefix.GroundsCareTask);
        return this.groundsData.careTasks.insert(task);
    }

    public async saveCareTask(userId: string, task: CareTask): Promise<CareTask> {
        task.userId = userId;
        return this.groundsData.careTasks.update(task);
    }

    public async getLocations(userId: string): Promise<Location[]> {
        return this.groundsData.locations.retrieveAll(userId);
    }

    public async getPlants(userId: string, varietyId?: string): Promise<Plant[]> {
        if (varietyId) {
            return this.groundsData.plants.retrieveByVariety(userId, varietyId);
        }
        return this.groundsData.plants.retrieveAll(userId);
    }

    public async getPlantVariety(userId: string, plantVarietyId: string): Promise<PlantVariety> {
        const data = await this.groundsData.plantVarieties.retrieveSingle(userId, plantVarietyId);
        if (!data) {
            throw new BadRequestError(`Plant variety not found for user ID: ${userId} and plant variety ID: ${plantVarietyId}`);
        }
        return data;
    }

    public async getPlantVarieties(userId: string): Promise<PlantVariety[]> {
        return this.groundsData.plantVarieties.retrieveAll(userId);
    }

    // TODO: "Create" plant variety
    // TODO: "Delete" plant variety

    public async savePlantData(userId: string, variety: PlantVariety, plants: Partial<Plant>[]): Promise<PlantVariety> {
        // TODO: validate ownership
        variety.userId = userId;
        const updatedVariety = await this.groundsData.plantVarieties.update(variety);

        // Sync plants
        const existingPlants = (await this.groundsData.plants.retrieveAll(userId))
            .filter(p => p.varietyId === variety.id);

        const submittedIds = new Set(plants.map(p => p.id).filter(id => id));

        // Delete removed plants
        for (const existingPlant of existingPlants) {
            if (!submittedIds.has(existingPlant.id)) {
                await this.groundsData.plants.delete(existingPlant.id, userId);
            }
        }

        // Insert new plants
        for (const submittedPlant of plants) {
            if (!submittedPlant.id) {
                const newPlant: Plant = {
                    id: EntityIdUtil.generate(EntityIdPrefix.GroundsPlant),
                    userId: userId,
                    varietyId: variety.id,
                    locationId: submittedPlant.locationId!,
                    plantedDate: submittedPlant.plantedDate ? new Date(submittedPlant.plantedDate) : new Date(),
                    createdAt: new Date(),
                    updatedAt: new Date()
                };
                await this.groundsData.plants.insert(newPlant);
            }
        }

        return updatedVariety;
    }

    // Products
    public async getProducts(userId: string): Promise<Product[]> {
        return this.groundsData.products.retrieveAll(userId);
    }

    public async getProduct(userId: string, productId: string): Promise<Product> {
        const data = await this.groundsData.products.retrieveSingle(userId, productId);
        if (!data) {
            throw new BadRequestError(`Product not found for user ID: ${userId} and product ID: ${productId}`);
        }
        return data;
    }

    public async createProduct(userId: string, product: Product): Promise<Product> {
        product.userId = userId;
        product.id = EntityIdUtil.generate(EntityIdPrefix.GroundsProduct);
        return this.groundsData.products.insert(product);
    }

    public async saveProduct(userId: string, product: Product): Promise<Product> {
        const current = await this.groundsData.products.retrieveSingle(userId, product.id);
        if (!current) {
            throw new BadRequestError(`Product not found for user ID: ${userId} and product ID: ${product.id}`);
        }

        return this.groundsData.products.update(product);
    }

    public async deleteProduct(userId: string, productId: string): Promise<void> {
        const current = await this.groundsData.products.retrieveSingle(userId, productId);
        if (!current) {
            throw new BadRequestError(`Product not found for user ID: ${userId} and product ID: ${productId}`);
        }

        await this.groundsData.products.delete(userId, productId);
    }
}