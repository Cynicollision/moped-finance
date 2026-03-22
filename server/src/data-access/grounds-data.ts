import { GroundsCareTaskData, IGroundsCareTaskData } from './grounds/care-task-data';
import { GroundsLocationData, IGroundsLocationData } from './grounds/location-data';
import { GroundsPlantData, IGroundsPlantData } from './grounds/plant-data';
import { GroundsPlantVarietyData, IGroundsPlantVarietyData } from './grounds/plant-variety-data';
import { GroundsProductData, IGroundsProductData } from './grounds/product-data';

export class GroundsData {
    constructor(
        readonly careTasks: IGroundsCareTaskData,
        readonly locations: IGroundsLocationData,
        readonly plants: IGroundsPlantData,
        readonly plantVarieties: IGroundsPlantVarietyData,
        readonly products: IGroundsProductData) {
    }

    public static forPgDatabase(): GroundsData {
        return new GroundsData(
            new GroundsCareTaskData(),
            new GroundsLocationData(),
            new GroundsPlantData(),
            new GroundsPlantVarietyData(),
            new GroundsProductData()
        );
    }
}