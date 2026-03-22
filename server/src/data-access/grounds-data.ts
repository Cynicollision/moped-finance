import { GroundsCareTaskData, IGroundsCareTaskData } from './grounds/care-task-data';

export class GroundsData {
    constructor(
        readonly careTaskData: IGroundsCareTaskData) {
    }

    public static forPgDatabase(): GroundsData {
        return new GroundsData(new GroundsCareTaskData());
    }
}