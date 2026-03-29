import { CareTask, Location, Plant, PlantVariety, Product } from '@shared/grounds/types';
import { EntityIdPrefix } from '@shared/core/enum/entity-id-prefix';
import { GroundsData } from './../data-access/grounds-data';
import { EntityIdUtil } from './../utility/entity-id';
import { AppLogger } from './../utility/logger';

import { BaseLogic } from './base-logic';

export class GroundsLogic extends BaseLogic {
    constructor(logger: AppLogger, private groundsData: GroundsData) {
        super(logger);
    }

    public async getCareTasks(userId: string, year: string): Promise<CareTask[]> {
        return await this.execute(userId, 'getCareTasks', () =>
            this.groundsData.careTasks.retrieveAll(userId)
        );
    }

    public async createCareTask(userId: string, task: CareTask): Promise<CareTask> {
        return await this.execute(userId, 'createCareTask', async () => {
            task.userId = userId;
            task.id = EntityIdUtil.generate(EntityIdPrefix.GroundsCareTask);
            return await this.groundsData.careTasks.insert(task);
        });
    }

    public async saveCareTask(userId: string, task: CareTask): Promise<CareTask> {
        return await this.execute(userId, 'saveCareTask', async () => {
            task.userId = userId;
            return await this.groundsData.careTasks.update(task);
        });
    }

    public async getLocations(userId: string): Promise<Location[]> {
        return await this.execute(userId, 'getLocations', () =>
            this.groundsData.locations.retrieveAll(userId)
        );
    }

    public async getPlants(userId: string): Promise<Plant[]> {
        return await this.execute(userId, 'getPlants', () =>
            this.groundsData.plants.retrieveAll(userId)
        );
    }

    public async getPlantVarieties(userId: string): Promise<PlantVariety[]> {
        return await this.execute(userId, 'getPlantVarieties', () =>
            this.groundsData.plantVarieties.retrieveAll(userId)
        );
    }

    public async getProducts(userId: string): Promise<Product[]> {
        return await this.execute(userId, 'getProducts', () =>
            this.groundsData.products.retrieveAll(userId)
        );
    }
}