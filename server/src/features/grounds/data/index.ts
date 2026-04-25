import { GroundsCareTaskData, IGroundsCareTaskData } from './care-task-data';
import { GroundsLocationData, IGroundsLocationData } from './location-data';
import { GroundsPlantData, IGroundsPlantData } from './plant-data';
import { GroundsPlantVarietyData, IGroundsPlantVarietyData } from './plant-variety-data';
import { GroundsProductData, IGroundsProductData } from './product-data';

export interface IGroundsData {
    readonly careTasks: IGroundsCareTaskData;
    readonly locations: IGroundsLocationData;
    readonly plants: IGroundsPlantData;
    readonly plantVarieties: IGroundsPlantVarietyData;
    readonly products: IGroundsProductData;
}

export class GroundsData implements IGroundsData {
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