import { GroundsCareTaskData, IGroundsCareTaskData } from './../features/grounds-data/care-task-data';
import { GroundsLocationData, IGroundsLocationData } from './../features/grounds-data/location-data';
import { GroundsPlantData, IGroundsPlantData } from './../features/grounds-data/plant-data';
import { GroundsPlantVarietyData, IGroundsPlantVarietyData } from './../features/grounds-data/plant-variety-data';
import { GroundsProductData, IGroundsProductData } from './../features/grounds-data/product-data';

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