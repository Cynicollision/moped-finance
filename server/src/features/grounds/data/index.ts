import { IDatabaseClient } from '@core/interfaces';
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

    public static forPgDatabase(db: IDatabaseClient): GroundsData {
        return new GroundsData(
            new GroundsCareTaskData(db),
            new GroundsLocationData(db),
            new GroundsPlantData(db),
            new GroundsPlantVarietyData(db),
            new GroundsProductData(db)
        );
    }
}