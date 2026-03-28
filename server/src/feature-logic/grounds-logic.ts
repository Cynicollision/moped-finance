import { CareTask, Location, Plant, PlantVariety, Product } from '@shared/grounds/types';
import { EntityIdPrefix } from '@shared/core/enum/entity-id-prefix';
import { generateEntityId } from './../utility/id-util';
import { GroundsData } from './../data-access/grounds-data';

export class GroundsLogic {
    constructor(private groundsData: GroundsData) {
    }

    public async getCareTasks(userId: string, year: string): Promise<CareTask[]> {
        return this.groundsData.careTasks.retrieveAll(userId);
    }

    public async createCareTask(userId: string, task: CareTask): Promise<CareTask> {
        task.userId = userId;
        task.id = generateEntityId(EntityIdPrefix.GroundsCareTask);
        return await this.groundsData.careTasks.insert(task);
    }

    public async saveCareTask(userId: string, task: CareTask): Promise<CareTask> {
        task.userId = userId;
        return await this.groundsData.careTasks.update(task);
    }

    public async getLocations(userId: string): Promise<Location[]> {
        return this.groundsData.locations.retrieveAll(userId);
    }

    public async getPlants(userId: string): Promise<Plant[]> {
        return this.groundsData.plants.retrieveAll(userId);
    }

    public async getPlantVarieties(userId: string): Promise<PlantVariety[]> {
        return this.groundsData.plantVarieties.retrieveAll(userId);
    }

    public async getProducts(userId: string): Promise<Product[]> {
        return this.groundsData.products.retrieveAll(userId);
    }
}