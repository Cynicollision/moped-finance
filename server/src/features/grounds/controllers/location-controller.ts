import { OperationResult } from '@shared/common/contracts';
import { Location } from '@shared/grounds/types';
import { AppLogger } from '@core/logger';
import { ResultUtil } from '@core/utility';
import { IGroundsLocationData } from './../data/location-data';

export class LocationController {
    constructor(
        private logger: AppLogger,
        private locations: IGroundsLocationData
    ) {
    }

    public async getLocations(userId: string): Promise<OperationResult<Location[]>> {
        return ResultUtil.success(await this.locations.retrieveAll(userId));
    }
}
