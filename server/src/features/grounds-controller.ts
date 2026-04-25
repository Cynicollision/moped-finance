import { GroundsSummary } from '@shared/grounds/contracts';
import { CareTask, Location, Plant, PlantVariety, Product } from '@shared/grounds/types';
import { EntityIdPrefix } from '@shared/core/enum/entity-id-prefix';
import { BaseResourceController, LanguageModelGateway } from './../core/interfaces';
import { EntityIdUtil } from './../utility/entity-id';
import { IGroundsData } from './grounds/data';
import { IWeatherGateway } from './grounds/gateways/weather-gateway';

export class GroundsController extends BaseResourceController {
    constructor(
        private groundsData: IGroundsData,
        private languageModelGateway: LanguageModelGateway,
        private weatherGateway: IWeatherGateway) {
        super();
    }

    // Summary
    // TODO: finish
    public async getGroundsSummary(userId: string): Promise<GroundsSummary> {
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
        return summary;
    }

    // Care Tasks
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

    // Plants
    public async getPlants(userId: string, varietyId?: string): Promise<Plant[]> {
        if (varietyId) {
            return this.groundsData.plants.retrieveByVariety(userId, varietyId);
        }
        return this.groundsData.plants.retrieveAll(userId);
    }

    public async getPlantVariety(userId: string, plantVarietyId: string): Promise<PlantVariety> {
        return this.validateOwnership(userId, plantVarietyId, this.groundsData.plantVarieties, 'Plant variety');
    }

    public async getPlantVarieties(userId: string): Promise<PlantVariety[]> {
        return this.groundsData.plantVarieties.retrieveAll(userId);
    }

    public async createPlantVariety(userId: string, plantVariety: PlantVariety): Promise<PlantVariety> {
        plantVariety.userId = userId;
        plantVariety.id = EntityIdUtil.generate(EntityIdPrefix.GroundsPlantVariety);
        return this.groundsData.plantVarieties.insert(plantVariety);
    }

    public async deletePlantVariety(userId: string, plantVarietyId: string): Promise<void> {
        await this.validateOwnership(userId, plantVarietyId, this.groundsData.plantVarieties, 'Plant variety');
        await this.groundsData.plantVarieties.delete(userId, plantVarietyId);
    }

    public async savePlantData(userId: string, variety: PlantVariety, plants: Partial<Plant>[]): Promise<PlantVariety> {
        await this.validateOwnership(userId, variety.id, this.groundsData.plantVarieties, 'Plant variety');

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
        return this.validateOwnership(userId, productId, this.groundsData.products, 'Product');
    }

    public async createProduct(userId: string, product: Product): Promise<Product> {
        product.userId = userId;
        product.id = EntityIdUtil.generate(EntityIdPrefix.GroundsProduct);
        return this.groundsData.products.insert(product);
    }

    public async saveProduct(userId: string, product: Product): Promise<Product> {
        await this.validateOwnership(userId, product.id, this.groundsData.products, 'Product');
        return this.groundsData.products.update(product);
    }

    public async deleteProduct(userId: string, productId: string): Promise<void> {
        await this.validateOwnership(userId, productId, this.groundsData.products, 'Product');
        await this.groundsData.products.delete(userId, productId);
    }
}