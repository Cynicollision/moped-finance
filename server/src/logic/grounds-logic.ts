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

    public async getPlants(userId: string, varietyId?: string): Promise<Plant[]> {
        return await this.execute(userId, 'getPlants', () => {
            if (varietyId) {
                return this.groundsData.plants.retrieveByVariety(userId, varietyId);
            }
            return this.groundsData.plants.retrieveAll(userId);
        });
    }

    public async getPlantVariety(userId: string, plantVarietyId: string): Promise<PlantVariety> {
        return await this.execute(userId, 'getPlantVariety', async () => {
            const data = await this.groundsData.plantVarieties.retrieveSingle(userId, plantVarietyId);
            if (data) {
                return data;
            }
            else {
                // TODO: better bad request error handling
                throw new Error(`Error: Plant variety not found for user ID: ${userId} and plant variety ID: ${plantVarietyId}`);
            }
        });
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

    public async savePlantData(userId: string, variety: PlantVariety, plants: Partial<Plant>[]): Promise<PlantVariety> {
        return await this.execute(userId, 'savePlantData', async () => {
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
        });
    }
}