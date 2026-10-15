import { AppSettings } from '@shared/core/types';
import { OperationContext, OperationResult, Result } from '@server/routing';
import { ISettingsData } from './settings-data';
import { UpdateSettingsRequest } from './settings-schema';

export class SettingsController {
    constructor(private settingsData: ISettingsData) {}

    public async getSettings(_context: OperationContext): Promise<OperationResult<AppSettings>> {
        return Result.success(await this.settingsData.retrieve());
    }

    public async updateSettings(
        _context: OperationContext,
        changes: UpdateSettingsRequest
    ): Promise<OperationResult<AppSettings>> {
        return Result.successUpdated(await this.settingsData.update(changes));
    }
}
