import { CareTask } from '@shared/grounds/types';
import { GroundsData } from './../data-access/grounds-data';

export class GroundsLogic {
    constructor(private groundsData: GroundsData) {
    }

    // TODO: filter by year/options
    public async getCareTasks(userId: string): Promise<CareTask[]> {
        return this.groundsData.careTaskData.retrieveAll(userId);
    }
}