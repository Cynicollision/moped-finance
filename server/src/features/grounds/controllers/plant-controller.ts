import { OperationResult } from '@shared/common/contracts';
import { EntityIdPrefix } from '@shared/common/enum';
import { Plant, PlantVariety } from '@shared/grounds/types';
import { AppLogger } from '@core/logger';
import { EntityIdUtil, ResultUtil } from '@core/utility';
import { IGroundsPlantData } from './../data/plant-data';
import { IGroundsPlantVarietyData } from './../data/plant-variety-data';

export class PlantController {
    constructor(
        private logger: AppLogger,
        private plants: IGroundsPlantData,
        private plantVarieties: IGroundsPlantVarietyData
    ) {
    }

    public async getPlants(userId: string, varietyId?: string): Promise<OperationResult<Plant[]>> {
        if (varietyId) {
            return ResultUtil.success(await this.plants.retrieveByVariety(userId, varietyId));
        }
        return ResultUtil.success(await this.plants.retrieveAll(userId));
    }

    public async getPlantVariety(userId: string, plantVarietyId: string): Promise<OperationResult<PlantVariety>> {
        const variety = await this.plantVarieties.retrieveSingle(userId, plantVarietyId);
        if (!variety) {
            return ResultUtil.userError('Plant variety not found or access denied');
        }
        return ResultUtil.success(variety);
    }

    public async getPlantVarieties(userId: string): Promise<OperationResult<PlantVariety[]>> {
        return ResultUtil.success(await this.plantVarieties.retrieveAll(userId));
    }

    public async createPlantVariety(userId: string, plantVariety: PlantVariety): Promise<OperationResult<PlantVariety>> {
        plantVariety.userId = userId;
        plantVariety.id = EntityIdUtil.generate(EntityIdPrefix.GroundsPlantVariety);
        return ResultUtil.success(await this.plantVarieties.insert(plantVariety));
    }

    public async deletePlantVariety(userId: string, plantVarietyId: string): Promise<OperationResult<void>> {
        const deleted = await this.plantVarieties.delete(userId, plantVarietyId);
        if (!deleted) {
            return ResultUtil.userError('Plant variety not found or access denied');
        }
        return ResultUtil.success();
    }

    public async savePlantData(userId: string, variety: PlantVariety, plants: Partial<Plant>[]): Promise<OperationResult<PlantVariety>> {
        const updatedVariety = await this.plantVarieties.update(variety);
        if (!updatedVariety) {
            return ResultUtil.userError('Plant variety not found or access denied');
        }

        // Sync plants
        const existingPlants = (await this.plants.retrieveAll(userId))
            .filter(p => p.varietyId === variety.id);

        const submittedIds = new Set(plants.map(p => p.id).filter(id => id));

        // Delete removed plants
        for (const existingPlant of existingPlants) {
            if (!submittedIds.has(existingPlant.id)) {
                await this.plants.delete(existingPlant.id, userId);
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
                await this.plants.insert(newPlant);
            }
        }

        return ResultUtil.success(updatedVariety);
    }
}
