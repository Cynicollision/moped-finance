import { OperationResult } from '@shared/core/contracts';
import { EntityIdPrefix } from '@shared/core/enum';
import { GroundsSummary } from '@shared/grounds/contracts';
import { CareTask, Location, Plant, PlantVariety, Product } from '@shared/grounds/types';
import { LanguageModelGateway } from './../core/interfaces';
import { EntityIdUtil, ResultUtil } from './../utility';
import { IGroundsData } from './grounds/data';
import { IWeatherGateway } from './grounds/gateways/weather-gateway';

export class GroundsController {
    constructor(
        private groundsData: IGroundsData,
        private languageModelGateway: LanguageModelGateway,
        private weatherGateway: IWeatherGateway) {
    }

    // Summary
    // TODO: finish
    public async getGroundsSummary(userId: string): Promise<OperationResult<GroundsSummary>> {
        const summary: GroundsSummary = {};

        const forecast = await this.weatherGateway.getForecast();
        summary.todaysShortForecast = forecast.properties.periods[0].shortForecast;
        summary.todaysDetailedForecast = forecast.properties.periods[0].detailedForecast;

        const rainDataPromptContext = forecast.properties.periods.map(period => {
            const chanceOfRain = period.probabilityOfPrecipitation?.value ?? 0;
            return `${period.name}: ${chanceOfRain}% chance of rain.`;
        }).join('\n');

        const rainSummaryPrompt = `Summarize the following rain forecast data into 1-2 sentences for purposes of lawn and garden maintenance to let them know when they should expect rain and if they should water their plants/lawn: \n${rainDataPromptContext}`;

        const rainSummary = await this.languageModelGateway.generateText(rainSummaryPrompt);
        summary.rainSummary = rainSummary;
        return ResultUtil.success(summary);
    }

    // Care Tasks
    public async getCareTasks(userId: string, year: string): Promise<OperationResult<CareTask[]>> {
        return ResultUtil.success(await this.groundsData.careTasks.retrieveAll(userId));
    }

    public async createCareTask(userId: string, task: CareTask): Promise<OperationResult<CareTask>> {
        task.userId = userId;
        task.id = EntityIdUtil.generate(EntityIdPrefix.GroundsCareTask);
        return ResultUtil.success(await this.groundsData.careTasks.insert(task));
    }

    public async saveCareTask(userId: string, task: CareTask): Promise<OperationResult<CareTask>> {
        task.userId = userId;
        const updated = await this.groundsData.careTasks.update(task);
        if (!updated) return ResultUtil.userError('Care task not found or access denied');
        return ResultUtil.success(updated);
    }

    public async getLocations(userId: string): Promise<OperationResult<Location[]>> {
        return ResultUtil.success(await this.groundsData.locations.retrieveAll(userId));
    }

    // Plants
    public async getPlants(userId: string, varietyId?: string): Promise<OperationResult<Plant[]>> {
        if (varietyId) {
            return ResultUtil.success(await this.groundsData.plants.retrieveByVariety(userId, varietyId));
        }
        return ResultUtil.success(await this.groundsData.plants.retrieveAll(userId));
    }

    public async getPlantVariety(userId: string, plantVarietyId: string): Promise<OperationResult<PlantVariety>> {
        const variety = await this.groundsData.plantVarieties.retrieveSingle(userId, plantVarietyId);
        if (!variety) return ResultUtil.userError('Plant variety not found or access denied');
        return ResultUtil.success(variety);
    }

    public async getPlantVarieties(userId: string): Promise<OperationResult<PlantVariety[]>> {
        return ResultUtil.success(await this.groundsData.plantVarieties.retrieveAll(userId));
    }

    public async createPlantVariety(userId: string, plantVariety: PlantVariety): Promise<OperationResult<PlantVariety>> {
        plantVariety.userId = userId;
        plantVariety.id = EntityIdUtil.generate(EntityIdPrefix.GroundsPlantVariety);
        return ResultUtil.success(await this.groundsData.plantVarieties.insert(plantVariety));
    }

    public async deletePlantVariety(userId: string, plantVarietyId: string): Promise<OperationResult<void>> {
        const deleted = await this.groundsData.plantVarieties.delete(userId, plantVarietyId);
        if (!deleted) return ResultUtil.userError('Plant variety not found or access denied');
        return ResultUtil.success();
    }

    public async savePlantData(userId: string, variety: PlantVariety, plants: Partial<Plant>[]): Promise<OperationResult<PlantVariety>> {
        const updatedVariety = await this.groundsData.plantVarieties.update(variety);
        if (!updatedVariety) return ResultUtil.userError('Plant variety not found or access denied');

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

        return ResultUtil.success(updatedVariety);
    }

    // Products
    public async getProducts(userId: string): Promise<OperationResult<Product[]>> {
        return ResultUtil.success(await this.groundsData.products.retrieveAll(userId));
    }

    public async getProduct(userId: string, productId: string): Promise<OperationResult<Product>> {
        const product = await this.groundsData.products.retrieveSingle(userId, productId);
        if (!product) return ResultUtil.userError('Product not found or access denied');
        return ResultUtil.success(product);
    }

    public async createProduct(userId: string, product: Product): Promise<OperationResult<Product>> {
        product.userId = userId;
        product.id = EntityIdUtil.generate(EntityIdPrefix.GroundsProduct);
        return ResultUtil.success(await this.groundsData.products.insert(product));
    }

    public async saveProduct(userId: string, product: Product): Promise<OperationResult<Product>> {
        const updated = await this.groundsData.products.update(product);
        if (!updated) return ResultUtil.userError('Product not found or access denied');
        return ResultUtil.success(updated);
    }

    public async deleteProduct(userId: string, productId: string): Promise<OperationResult<void>> {
        const deleted = await this.groundsData.products.delete(userId, productId);
        if (!deleted) return ResultUtil.userError('Product not found or access denied');
        return ResultUtil.success();
    }
}